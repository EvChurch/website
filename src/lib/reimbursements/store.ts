import { createHash, randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { z } from 'zod-v3'
import { buildReportPdf, loadReportReceipts } from './pdf'
import { ReceiptValidationError, validateReceipt } from './receipts'

import { rejectedExpenseSummary, defaultMinimumReportAmountMinor, approvalPerson, canArchiveReport, isArchivedReport, hasPaymentSettings, paymentProfileSchema, draftSchema, lineSchema, money, reportNumber, validateSubmission, type Actor, type Category, type Centre, type Report, type Settings } from './model'

type Database = Pick<Pool, 'query'>
export class ReimbursementError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
interface ReportRow {
  id: string; number: number; claimant_id: number; claimant_name: string; claimant_email: string;
  status: Report['status']; version: number; revision: number; centre_id: number | null;
  centre_name: string; account_name: string; account_number: string; lines: Report['lines']; history: Report['history'];
  rc_approver_id: number | null; campus_id: number | null; campus_name: string;
  payout_override: Report['payoutOverride'];
  created_at: Date; updated_at: Date;
}
function reportFromRow(row: ReportRow): Report {
  return {
    id: row.id, number: row.number, claimantId: row.claimant_id, claimantName: row.claimant_name,
    campusId: row.campus_id ?? null, campusName: row.campus_name ?? '',
    claimantEmail: row.claimant_email, centreId: row.centre_id, centreName: row.centre_name,
    accountName: row.account_name, accountNumber: row.account_number, payoutOverride: row.payout_override ?? null, lines: row.lines.map(line => lineSchema.parse(line)), history: row.history,
    status: row.status, version: row.version, revision: row.revision, rcApproverId: row.rc_approver_id,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
  }
}
export async function directory(db: Database) {
  const [centres, categories, settings, campuses] = await Promise.all([
    db.query<{ id: number; name: string; approverRockPersonId: string | null; approverName: string | null; approverEmail: string | null; financeOnly: boolean }>(
      `SELECT id,name,approver_rock_person_id AS "approverRockPersonId",approver_name AS "approverName",approver_email AS "approverEmail",finance_only AS "financeOnly"
       FROM responsibility_centres WHERE is_active=true AND (is_local=true OR last_synced_at>now()-interval '45 minutes') ORDER BY sort_order,name`),
    db.query<Category>('SELECT id,name,archived FROM reimbursement_categories ORDER BY id'),
    db.query<{ data: Settings }>('SELECT data FROM reimbursement_settings WHERE id=1'),
    db.query<{ id: number; name: string }>('SELECT id,name FROM campuses WHERE is_active=true ORDER BY "order",name'),
  ])
  if (!settings.rows[0]) throw new ReimbursementError('Reimbursement settings are unavailable.', 503)
  return { campuses: campuses.rows, centres: centres.rows.map(row => ({ ...row, approverRockPersonId: row.approverRockPersonId ? Number(row.approverRockPersonId) : null })) satisfies Centre[], categories: categories.rows, settings: { ...settings.rows[0].data, minimumReportAmountMinor: settings.rows[0].data.minimumReportAmountMinor ?? defaultMinimumReportAmountMinor } }
}
export async function isFinance(db: Database, personId: number) {
  return (await db.query(`SELECT 1 FROM reimbursement_finance_members WHERE rock_person_id=$1 AND last_synced_at>now()-interval '45 minutes' LIMIT 1`, [personId])).rowCount !== 0
}
export async function hasOpened(db: Database, personId: number) {
  return Boolean((await db.query('SELECT 1 FROM reimbursement_profiles WHERE person_id=$1', [personId])).rowCount)
}
export async function openReimbursements(db: Database, personId: number) {
  await db.query('INSERT INTO reimbursement_profiles(person_id) VALUES($1) ON CONFLICT DO NOTHING', [personId])
}

export function reportPermissions(actor: Actor, report: Report, centres: Centre[], settings: Settings) {
  const owner = actor.personId === report.claimantId
  const approver = approvalPerson(centres.find(centre => centre.id === report.centreId), report.claimantId, settings)
  const centre = centres.find(centre => centre.id === report.centreId)
  const visible = owner || (report.status !== 'draft' && (actor.finance || actor.admin || (!centre?.financeOnly && centre?.approverRockPersonId === actor.personId) || approver?.id === actor.personId))
  const active = !isArchivedReport(report)
  return {
    visible,
    edit: active && owner && ['draft', 'rejected'].includes(report.status),
    withdraw: active && owner && ['rc-approval', 'finance-approval'].includes(report.status),
    approveRC: active && !owner && report.status === 'rc-approval' && approver?.id === actor.personId,
    approveFinance: active && !owner && actor.finance && report.status === 'finance-approval' && report.rcApproverId !== actor.personId,
    payment: actor.finance && report.status === 'awaiting-payment',
    bank: owner || actor.finance,
  }
}
export async function paymentProfile(db: Database, personId: number) {
  return (await db.query<{ accountName: string; accountNumber: string }>('SELECT account_name AS "accountName",account_number AS "accountNumber" FROM reimbursement_profiles WHERE person_id=$1', [personId])).rows[0] ?? { accountName: '', accountNumber: '' }
}

export async function memberOverview(db: Database, actor: Actor): Promise<Awaited<ReturnType<typeof overview>>> {
  const defaults = await paymentProfile(db, actor.personId)
  if (hasPaymentSettings(defaults)) return overview(db, actor)
  return { reports: [], notificationFailures: [], campuses: [], centres: [], categories: [], settings: undefined,
    minimumReportAmountMinor: defaultMinimumReportAmountMinor,
    approvalFallbacks: { seniorPersonId: null, seniorName: '', alternatePersonId: null, alternateName: '' },
    defaults, manage: actor.finance || actor.admin, finance: actor.finance, personId: actor.personId }
}

export async function overview(db: Database, actor: Actor) {
  const context = await directory(db)
  // Filter in SQL before loading report bodies containing receipts and private banking data.
  const ids = context.centres.filter(centre => !centre.financeOnly && centre.approverRockPersonId === actor.personId).map(centre => centre.id)
  const fallbackIds = context.centres.filter(centre => approvalPerson(centre, centre.approverRockPersonId ?? 0, context.settings)?.id === actor.personId).map(centre => centre.id)
  const rows = await db.query<ReportRow>(`SELECT * FROM reimbursement_reports WHERE claimant_id=$1 OR
    (status<>'draft' AND ($2::boolean OR centre_id=ANY($3::int[]) OR centre_id=ANY($4::int[]))) ORDER BY updated_at DESC`,
  [actor.personId, actor.finance || actor.admin, ids, fallbackIds])
  const reports = rows.rows.map(reportFromRow).filter(report => reportPermissions(actor, report, context.centres, context.settings).visible)
    .map(report => {
      const permissions = reportPermissions(actor, report, context.centres, context.settings)
      return { ...report, accountName: permissions.bank ? report.accountName : '', accountNumber: permissions.bank ? report.accountNumber : '', payoutOverride: permissions.bank ? report.payoutOverride : null, permissions }
    })
  const notifications = actor.finance || actor.admin ? await db.query<{ number: number; subject: string }>(`SELECT r.number,d.subject FROM reimbursement_email_deliveries d JOIN reimbursement_reports r ON r.id=d.report_id WHERE d.state='failed' ORDER BY d.created_at DESC LIMIT 20`) : { rows: [] }
  const defaults = await db.query<{ accountName: string; accountNumber: string }>('SELECT account_name AS "accountName",account_number AS "accountNumber" FROM reimbursement_profiles WHERE person_id=$1', [actor.personId])
  return { reports, notificationFailures: notifications.rows, campuses: context.campuses, centres: context.centres.map(({ approverEmail: _email, ...centre }) => centre), categories: context.categories,
    settings: actor.finance || actor.admin ? context.settings : undefined,
    minimumReportAmountMinor: context.settings.minimumReportAmountMinor,
    approvalFallbacks: { seniorPersonId: context.settings.seniorPersonId, seniorName: context.settings.seniorName, alternatePersonId: context.settings.alternatePersonId, alternateName: context.settings.alternateName },
    defaults: defaults.rows[0] ?? { accountName: '', accountNumber: '' }, manage: actor.finance || actor.admin, finance: actor.finance, personId: actor.personId }
}

async function event(db: Database, report: Report, actor: Actor, action: string, reason = '', rejectedLineIds: string[] = []) {
  const activity = { at: new Date().toISOString(), personId: actor.personId, name: actor.name, action, reason, revision: report.revision, ...(action === 'submit' ? { snapshot: { centreName: report.centreName, campusId: report.campusId, campusName: report.campusName, lines: report.lines } } : {}) }
  const rejectedLines = report.lines.flatMap((line, index) => rejectedLineIds.includes(line.id) ? [{ id: line.id, number: index + 1, description: line.description }] : [])
  await db.query(`UPDATE reimbursement_reports SET history=history || $2::jsonb WHERE id=$1`, [report.id, JSON.stringify([{ ...activity, ...(action === 'reject' ? { rejectedLines } : {}) }])])
}

async function queue(db: Database, report: Report, kind: string, recipient: string, subject: string, body: string, payment = false, pdf = false) {
  if (!recipient) throw new ReimbursementError('A notification email address has not been configured.')
  await db.query(`INSERT INTO reimbursement_email_deliveries(id,report_id,version,revision,kind,recipient,subject,body,include_payment,include_pdf)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(report_id,revision,kind,recipient) DO UPDATE SET version=EXCLUDED.version,subject=EXCLUDED.subject,body=EXCLUDED.body,created_at=CASE WHEN reimbursement_email_deliveries.state='cancelled' THEN now() ELSE reimbursement_email_deliveries.created_at END,state='pending' WHERE reimbursement_email_deliveries.state IN ('pending','cancelled') AND reimbursement_email_deliveries.attempts=0`,
  [randomUUID(), report.id, report.version, report.revision, kind, recipient, subject, body, payment, pdf])
}

export async function queueStateNotifications(db: Database, report: Report, context: Awaited<ReturnType<typeof directory>>, reminder = '') {
  if (isArchivedReport(report)) return
  const label = reportNumber(report.number)
  const total = money(report.lines.reduce((sum, line) => sum + (line.amountMinor ?? 0), 0))
  const summary = `${label}\nClaimant: ${report.claimantName}\nPurpose: ${report.centreName}\nCampus: ${report.campusName || 'Not recorded'}\nTotal: ${total} NZD`
  const approver = approvalPerson(context.centres.find(centre => centre.id === report.centreId), report.claimantId, context.settings)
  if (report.status === 'rc-approval') {
    if (approver) await queue(db, report, `rc${reminder}`, approver.email, `${label} needs your approval`, `${summary}\n\nPlease review and approve or reject this report.`)
  } else if (report.status === 'finance-approval') {
    await queue(db, report, `finance${reminder}`, context.settings.financeEmail, `${label} needs finance approval`, summary)
  } else if (report.status === 'awaiting-payment') {
    await queue(db, report, `payment${reminder}`, context.settings.financeEmail, `${label} ready for payment`, summary, true, true)
    if (!reminder) {
      await queue(db, report, 'approved', report.claimantEmail, `${label} approved for payment`, `${summary}\n\nYour expense report has been approved and is awaiting payment.`)
      if (approver?.email) await queue(db, report, 'rc-payment', approver.email, `${label} approved for payment`, summary, false, true)
    }
  } else if (report.status === 'rejected') {
    const rejection = report.history.at(-1)
    const reason = [rejection?.reason, rejection && rejectedExpenseSummary(rejection)].filter(Boolean).join('\n\n')
    await queue(db, report, 'rejected', report.claimantEmail, `${label} needs changes`, `${summary}\n\nReason: ${reason}\n\nYou can edit and resubmit the report. The approval process will restart.`)
  } else if (report.status === 'paid') {
    await queue(db, report, 'paid', report.claimantEmail, `${label} remittance advice`, `${summary}\n\nFinance has confirmed payment of your expense report.`, true, true)
  }
}

async function transaction<T>(pool: Pool, operation: (db: PoolClient) => Promise<T>) {
  const db = await pool.connect()
  try { await db.query('BEGIN'); const result = await operation(db); await db.query('COMMIT'); return result }
  catch (error) { await db.query('ROLLBACK'); throw error }
  finally { db.release() }
}
async function lockedReport(db: Database, id: string) {
  const row = (await db.query<ReportRow>('SELECT * FROM reimbursement_reports WHERE id=$1 FOR UPDATE', [id])).rows[0]
  if (!row) throw new ReimbursementError('Report not found.', 404)
  return reportFromRow(row)
}

export async function createReport(pool: Pool, actor: Actor) {
  return transaction(pool, async db => {
    await openReimbursements(db, actor.personId)
    const id = randomUUID()
    await db.query(`INSERT INTO reimbursement_reports(id,claimant_id,claimant_name,claimant_email) VALUES($1,$2,$3,$4)`,
      [id, actor.personId, actor.name, actor.email])
    return id
  })
}
export async function saveProfile(pool: Pool, actor: Actor, input: unknown) {
  const parsed = paymentProfileSchema.safeParse(input)
  if (!parsed.success) throw new ReimbursementError('Enter an account holder and a valid New Zealand bank account number.')
  const profile = parsed.data
  await pool.query(`INSERT INTO reimbursement_profiles(person_id,account_name,account_number) VALUES($1,$2,$3)
    ON CONFLICT(person_id) DO UPDATE SET account_name=EXCLUDED.account_name,account_number=EXCLUDED.account_number`,
    [actor.personId, profile.accountName, profile.accountNumber])
}

export async function saveDraft(pool: Pool, actor: Actor, id: string, version: number, input: unknown) {
  const draft = draftSchema.parse(input)
  return transaction(pool, async db => {
    const report = await lockedReport(db, id)
    if (report.claimantId !== actor.personId || isArchivedReport(report) || !['draft', 'rejected'].includes(report.status)) throw new ReimbursementError('This report must be returned to draft before editing.', 403)
    if (report.version !== version) throw new ReimbursementError('This report changed in another window. Reload before editing.', 409)
    for (const hash of new Set(draft.lines.map(line => line.receiptHash).filter(Boolean))) {
      if (!(await db.query('SELECT 1 FROM reimbursement_receipt_owners WHERE hash=$1 AND person_id=$2', [hash, actor.personId])).rowCount) throw new ReimbursementError('Upload the receipt before attaching it.', 403)
    }
    const context = await directory(db)
    const centre = context.centres.find(centre => centre.id === draft.centreId && (centre.financeOnly || centre.approverRockPersonId))
    if (draft.centreId !== null && !centre) throw new ReimbursementError('Choose an active purpose with an assigned approver or finance-only approval.')
    const campus = context.campuses.find(campus => campus.id === draft.campusId)
    if (draft.campusId != null && !campus) throw new ReimbursementError('Choose an active campus.')
    const lines = draft.lines.map(line => ({ ...line, categoryName: context.categories.find(category => category.id === line.categoryId)?.name ?? '' }))
    await db.query(`UPDATE reimbursement_reports SET centre_id=$2,centre_name=$3,lines=$4::jsonb,payout_override=$5::jsonb,campus_id=$6,campus_name=$7,version=version+1,updated_at=now() WHERE id=$1`,
      [id, draft.centreId, centre?.name ?? '', JSON.stringify(lines), draft.payoutOverride ? JSON.stringify(draft.payoutOverride) : null, campus?.id ?? null, campus?.name ?? ''])
    return version + 1
  })
}

export const actionSchema = z.object({
  action: z.enum(['submit', 'withdraw', 'approve', 'reject', 'return', 'archive', 'restore']),
  version: z.number().int().positive(), reason: z.string().max(2000).default(''),
  rejectedLineIds: z.array(z.string().uuid()).max(100).default([]),
})
export async function actOnReport(pool: Pool, actor: Actor, id: string, input: unknown) {
  const command = actionSchema.parse(input)
  return transaction(pool, async db => {
    const report = await lockedReport(db, id)
    if (report.version !== command.version) throw new ReimbursementError('This report changed. Reload and review it again.', 409)
    const context = await directory(db)
    const access = reportPermissions(actor, report, context.centres, context.settings)
    if (!access.visible) throw new ReimbursementError('Report not found.', 404)
    if (command.rejectedLineIds.length && command.action !== 'reject') throw new ReimbursementError('Expense selection is only available when rejecting a report.')
    if (new Set(command.rejectedLineIds).size !== command.rejectedLineIds.length || command.rejectedLineIds.some(id => !report.lines.some(line => line.id === id))) throw new ReimbursementError('Select expenses from this report only.')
    if (command.action === 'archive' || command.action === 'restore') {
      if (actor.personId !== report.claimantId) throw new ReimbursementError('Only the claimant can archive or restore this report.', 403)
      if (command.action === 'archive' && !isArchivedReport(report) && !canArchiveReport(report)) throw new ReimbursementError('This report cannot be archived at this stage.', 403)
      if (isArchivedReport(report) !== (command.action === 'restore')) throw new ReimbursementError('This report is already in that section.', 409)
      await event(db, report, actor, command.action)
      await db.query(`UPDATE reimbursement_reports SET status=CASE WHEN $2='restore' THEN 'draft' ELSE status END,
        rc_approver_id=CASE WHEN $2='restore' THEN NULL ELSE rc_approver_id END,version=version+1,updated_at=now() WHERE id=$1`, [id, command.action])
      await db.query(`UPDATE reimbursement_email_deliveries SET state='cancelled',lease_until=NULL,lease_token=NULL WHERE report_id=$1 AND state IN ('pending','failed','sending')`, [id])
      return report.version + 1
    }
    if (isArchivedReport(report)) throw new ReimbursementError('Restore this archived report before making changes.', 403)
    let status = report.status
    let rcApproverId = report.rcApproverId
    if (command.action === 'submit') {
      if (!access.edit) throw new ReimbursementError('You cannot submit this report.', 403)
      const profile = (await db.query<{ account_name: string; account_number: string }>('SELECT account_name,account_number FROM reimbursement_profiles WHERE person_id=$1', [actor.personId])).rows[0]
      report.accountName = (report.payoutOverride?.accountName ?? profile?.account_name ?? '').trim()
      report.accountNumber = (report.payoutOverride?.accountNumber ?? profile?.account_number ?? '').trim()
      const errors = validateSubmission(report, context.categories, report, context.settings.minimumReportAmountMinor)
      const centre = context.centres.find(centre => centre.id === report.centreId)
      const approver = approvalPerson(centre, report.claimantId, context.settings)
      if (!centre) errors.push('Choose an active purpose before submission.')
      if (!context.campuses.some(campus => campus.id === report.campusId)) errors.push('Choose an active campus before submission.')
      if (!centre?.financeOnly && !approver?.email) errors.push('An eligible purpose approver must be configured before submission.')
      if (!context.settings.financeEmail) errors.push('Finance must configure its notification email before submission.')
      if (errors.length) throw new ReimbursementError(errors.join('\n'))
      try {
        // Validate the complete, finance-sized attachment before entering approvals.
        await buildReportPdf(report, context.categories, true, await loadReportReceipts(db, report), 'submission')
      } catch (error) {
        if (error instanceof ReceiptValidationError) throw new ReimbursementError(error.message)
        throw new ReimbursementError('A receipt could not be included in the report PDF. Replace unreadable receipts and try submitting again.')
      }
      status = centre?.financeOnly ? 'finance-approval' : 'rc-approval'; rcApproverId = null; report.revision++
    } else if (command.action === 'withdraw') {
      if (!access.withdraw) throw new ReimbursementError('You cannot withdraw this report.', 403)
      status = 'draft'; rcApproverId = null
    } else if (command.action === 'approve' || command.action === 'reject') {
      if (!access.approveRC && !access.approveFinance) throw new ReimbursementError('You are not the current approver.', 403)
      if (command.action === 'reject') {
        if (!command.reason.trim()) throw new ReimbursementError('Give a reason for rejection.')
        status = 'rejected'; rcApproverId = null
      } else if (access.approveRC) { status = 'finance-approval'; rcApproverId = actor.personId }
      else status = 'awaiting-payment'
    } else if (command.action === 'return') {
      if (!actor.finance || report.status !== 'awaiting-payment') throw new ReimbursementError('You cannot return this report.', 403)
      if (!command.reason.trim()) throw new ReimbursementError('Give a reason.')
      status = 'rejected'; rcApproverId = null
    }
    const reason = command.action === 'submit'
      ? `Submitted ${reportNumber(report.number)} for ${money(report.lines.reduce((sum, line) => sum + (line.amountMinor ?? 0), 0))}`
      : command.reason.trim()
    await event(db, report, actor, command.action, reason, command.rejectedLineIds)
    await db.query(`UPDATE reimbursement_reports SET status=$2,rc_approver_id=$3,revision=$4,lines=$5::jsonb,account_name=$6,account_number=$7,version=version+1,updated_at=now() WHERE id=$1`,
      [id, status, rcApproverId, report.revision, JSON.stringify(report.lines), report.accountName, report.accountNumber])
    await db.query(`UPDATE reimbursement_email_deliveries SET state='cancelled',lease_until=NULL,lease_token=NULL WHERE report_id=$1 AND state IN ('pending','failed','sending')`, [id])
    const updated = await lockedReport(db, id)
    await queueStateNotifications(db, updated, context)
    return updated.version
  })
}

export async function markBatchPaid(pool: Pool, actor: Actor, input: unknown) {
  if (!actor.finance) throw new ReimbursementError('Only finance can record payments.', 403)
  const command = z.object({
    reports: z.array(z.object({ id: z.string().uuid(), version: z.number().int().positive() })).min(1).max(100),
  }).strict().parse(input)
  if (new Set(command.reports.map(report => report.id)).size !== command.reports.length) throw new ReimbursementError('Select each report only once.')
  return transaction(pool, async db => {
    const context = await directory(db)
    for (const item of [...command.reports].sort((a, b) => a.id.localeCompare(b.id))) {
      const report = await lockedReport(db, item.id)
      if (report.status !== 'awaiting-payment' || report.version !== item.version) throw new ReimbursementError('A selected report changed or is no longer awaiting payment.', 409)
      await event(db, report, actor, 'paid')
      await db.query(`UPDATE reimbursement_reports SET status='paid',version=version+1,updated_at=now() WHERE id=$1`, [item.id])
      await db.query(`UPDATE reimbursement_email_deliveries SET state='cancelled',lease_until=NULL,lease_token=NULL WHERE report_id=$1 AND state IN ('pending','failed','sending')`, [item.id])
      await queueStateNotifications(db, await lockedReport(db, item.id), context)
    }
  })
}

export async function uploadReceipt(pool: Pool, actor: Actor, body: Buffer, filename: string, mediaType: string) {
  let detected: string
  try { detected = (await validateReceipt(body, mediaType)).mediaType }
  catch (error) {
    if (error instanceof ReceiptValidationError) throw new ReimbursementError(error.message)
    throw error
  }
  const hash = createHash('sha256').update(body).digest('hex')
  await transaction(pool, async db => {
    await db.query('INSERT INTO reimbursement_receipts(hash,media_type,body) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [hash, detected, body])
    await db.query('INSERT INTO reimbursement_receipt_owners(hash,person_id,filename) VALUES($1,$2,$3) ON CONFLICT(hash,person_id) DO NOTHING', [hash, actor.personId, filename.slice(0, 200)])
  })
  return hash
}

export const settingsSchema = z.object({
  seniorPersonId: z.number().int().positive().nullable(), seniorName: z.string().max(200), seniorEmail: z.union([z.literal(''), z.string().email()]),
  alternatePersonId: z.number().int().positive().nullable(), alternateName: z.string().max(200), alternateEmail: z.union([z.literal(''), z.string().email()]),
  financeEmail: z.string().email(),
  minimumReportAmountMinor: z.number().int().min(0).max(100_000_000).default(defaultMinimumReportAmountMinor),
})
export async function configure(pool: Pool, actor: Actor, input: unknown) {
  if (!actor.finance && !actor.admin) throw new ReimbursementError('Finance or administrator access required.', 403)
  const command = z.object({ settings: settingsSchema, categories: z.array(z.object({
    id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(120), archived: z.boolean(),
  })).min(1).max(100) }).parse(input)
  await transaction(pool, async db => {
    await db.query('UPDATE reimbursement_settings SET data=$1::jsonb WHERE id=1', [JSON.stringify(command.settings)])
    for (const category of command.categories) {
      if (category.id) await db.query('UPDATE reimbursement_categories SET name=$2,archived=$3 WHERE id=$1', [category.id, category.name, category.archived])
      else await db.query('INSERT INTO reimbursement_categories(name,archived) VALUES($1,$2)', [category.name, category.archived])
    }
  })
}
