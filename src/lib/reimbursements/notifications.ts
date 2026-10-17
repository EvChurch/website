import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { buildReportPdf, loadReportReceipts } from './pdf'
import { buildReimbursementEmail } from './email'
import { directory, overview, queueStateNotifications } from './store'
import { approvalPerson, isArchivedReport, reportNumber, type Report } from './model'

interface StoredEmail { to: string; subject: string; text: string; html?: string; pdf?: string; filename?: string }
interface Delivery { revision: number; payload: StoredEmail | null; first_attempt_at: Date; id: string; report_id: string; version: number; kind: string; recipient: string; subject: string; body: string; include_payment: boolean; include_pdf: boolean; created_at: Date }
export interface ReimbursementEmail { to: string; subject: string; text: string; html?: string; pdf?: Buffer; filename?: string }
export type EmailTransport = (message: ReimbursementEmail, idempotencyKey: string) => Promise<string>

export const sendReimbursementEmail: EmailTransport = async (message, key) => {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.REIMBURSEMENT_EMAIL_FROM?.trim() || process.env.GIVING_EMAIL_FROM?.trim() || process.env.SITE_FEEDBACK_EMAIL_FROM?.trim()
  if (!apiKey || !from) throw new Error('Reimbursement email provider is not configured')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ from, to: [message.to], reply_to: 'tataihono@ev.church', subject: message.subject, text: message.text, html: message.html,
      ...(message.pdf ? { attachments: [{ filename: message.filename, content: message.pdf.toString('base64') }] } : {}) }),
    signal: AbortSignal.timeout(15_000),
  })
  const data: unknown = await response.json()
  if (!response.ok || !data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string') throw new Error('Email provider did not accept delivery')
  return data.id
}

async function internalReport(pool: Pick<Pool, 'query'>, id: string) {
  // A dedicated internal read; external callers must use the authenticated overview.
  const row = (await pool.query<{ claimant_id: number }>('SELECT claimant_id FROM reimbursement_reports WHERE id=$1', [id])).rows[0]
  if (!row) return null
  const data = await overview(pool, { personId: row.claimant_id, name: '', email: '', finance: false, admin: false })
  return data.reports.find(report => report.id === id) ?? null
}

export async function reconcileReimbursementEmails(pool: Pool, transport: EmailTransport = sendReimbursementEmail, now = new Date()) {
  const context = await directory(pool)
  const pending = await pool.query<{ id: string; updated_at: Date; status: Report['status'] }>(`SELECT id,updated_at,status FROM reimbursement_reports WHERE status IN ('rc-approval','finance-approval','awaiting-payment')`)
  for (const item of pending.rows) {
    const report = await internalReport(pool, item.id)
    if (!report || isArchivedReport(report)) continue
    // Also queues a first notification to a newly assigned RC approver, without restarting completed approvals.
    try {
      await queueStateNotifications(pool, report, context)
      const prefix = item.status === 'rc-approval' ? 'rc' : item.status === 'finance-approval' ? 'finance' : 'payment'
      const recipient = prefix === 'rc' ? approvalPerson(context.centres.find(centre => centre.id === report.centreId), report.claimantId, context.settings)?.email : context.settings.financeEmail
      const previous = await pool.query<{ latest: Date | null }>(`SELECT max(COALESCE(sent_at,first_attempt_at,created_at)) latest FROM reimbursement_email_deliveries
        WHERE report_id=$1 AND revision=$2 AND recipient=$3 AND kind LIKE $4`, [report.id, report.revision, recipient, `${prefix}%`])
      const lastContact = previous.rows[0]?.latest ?? item.updated_at
      const every = item.status === 'awaiting-payment' ? 7 : 2
      const interval = every * 86_400_000
      // A newly assigned person gets one initial request, then their own reminder cadence.
      if (now.getTime() - lastContact.getTime() >= interval) await queueStateNotifications(pool, report, context, `-reminder-${Math.floor(now.getTime() / interval)}`)
    } catch { console.error('Reimbursement notification configuration requires attention', { reportNumber: report.number }) }
  }
  // An interrupted final attempt must become visible instead of remaining leased forever.
  await pool.query(`UPDATE reimbursement_email_deliveries SET state='failed',lease_until=NULL,lease_token=NULL
    WHERE attempts>=6 AND (state='pending' OR state='sending' AND lease_until<now())`)
  const ids = await pool.query<{ id: string }>(`SELECT id FROM reimbursement_email_deliveries
    WHERE (state='pending' OR state='sending' AND lease_until<now()) AND attempts<6 ORDER BY created_at LIMIT 50`)
  let sent = 0
  for (const { id } of ids.rows) {
    const token = randomUUID()
    const claim = await pool.query<Delivery>(`UPDATE reimbursement_email_deliveries SET state='sending',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,$3::timestamptz),lease_token=$2,lease_until=now()+interval '5 minutes'
      WHERE id=$1 AND (state='pending' OR state='sending' AND lease_until<now()) AND attempts<6 RETURNING *`, [id, token, now])
    const item = claim.rows[0]
    if (!item) continue
    try {
      const report = await internalReport(pool, item.report_id)
      const currentContext = await directory(pool)
      const status = item.kind.startsWith('rc-reminder') || item.kind === 'rc' ? 'rc-approval'
        : item.kind.startsWith('finance') ? 'finance-approval'
          : item.kind.startsWith('payment') || item.kind === 'approved' || item.kind === 'rc-payment' ? 'awaiting-payment'
            : item.kind === 'paid' ? 'paid' : 'rejected'
      // Never deliver approval requests or bank details for an obsolete revision/state.
      let valid = report && !isArchivedReport(report) && report.revision === item.revision && report.status === status
      if (valid && report && (item.kind === 'rc' || item.kind.startsWith('rc-reminder'))) {
        const approver = approvalPerson(currentContext.centres.find(centre => centre.id === report.centreId), report.claimantId, currentContext.settings)
        valid = Boolean(approver && approver.email === item.recipient)
      }
      if (valid && report && (item.kind.startsWith('finance') || item.kind.startsWith('payment'))) valid = item.recipient === currentContext.settings.financeEmail
      if (valid && report && item.kind === 'rc-payment') {
        const approver = approvalPerson(currentContext.centres.find(centre => centre.id === report.centreId), report.claimantId, currentContext.settings)
        valid = approver?.email === item.recipient
      }
      if (valid && report && item.kind === 'paid') valid = item.recipient === report.claimantEmail
      if (!valid || !report) {
        await pool.query(`UPDATE reimbursement_email_deliveries SET state='cancelled',lease_until=NULL,lease_token=NULL,attempts=CASE WHEN payload IS NULL THEN 0 ELSE attempts END,first_attempt_at=CASE WHEN payload IS NULL THEN NULL ELSE first_attempt_at END WHERE id=$1 AND lease_token=$2`, [id, token]); continue
      }
      // Resend's idempotency window is 24h. Avoid automatic recovery beyond that window.
      if (now.getTime() - item.first_attempt_at.getTime() > 23 * 60 * 60 * 1000) throw new Error('Delivery requires provider-history review')
      const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL
      if (!base) throw new Error('Website URL is not configured')
      let stored = item.payload
      if (!stored) {
        const message = { ...buildReimbursementEmail(item, report, base),
          ...(item.include_pdf ? { pdf: (await buildReportPdf(report, currentContext.categories, item.include_payment, await loadReportReceipts(pool, report))).toString('base64'), filename: `${reportNumber(report.number)}.pdf` } : {}),
        } satisfies StoredEmail
        const persisted = await pool.query<{ payload: StoredEmail }>(`UPDATE reimbursement_email_deliveries SET payload=COALESCE(payload,$3::jsonb) WHERE id=$1 AND lease_token=$2 RETURNING payload`, [id, token, JSON.stringify(message)])
        stored = persisted.rows[0]?.payload
        if (!stored) continue
      }
      // Serialize dispatch with report transitions. PDF preparation happens outside the
      // lock, then the delivery lease and report state are checked again before sending.
      const db = await pool.connect()
      try {
        await db.query('BEGIN')
        await db.query('SELECT id FROM reimbursement_reports WHERE id=$1 FOR UPDATE', [item.report_id])
        const current = await internalReport(db, item.report_id)
        const lease = await db.query("SELECT 1 FROM reimbursement_email_deliveries WHERE id=$1 AND lease_token=$2 AND state='sending' FOR UPDATE", [id, token])
        const latestContext = await directory(db)
        let deliver = Boolean(current && !isArchivedReport(current) && current.revision === item.revision && current.status === status && lease.rowCount)
        if (deliver && current && (item.kind === 'rc' || item.kind.startsWith('rc-reminder') || item.kind === 'rc-payment')) {
          deliver = approvalPerson(latestContext.centres.find(centre => centre.id === current.centreId), current.claimantId, latestContext.settings)?.email === item.recipient
        }
        if (deliver && (item.kind.startsWith('finance') || item.kind.startsWith('payment'))) deliver = item.recipient === latestContext.settings.financeEmail
        if (!deliver) {
          await db.query("UPDATE reimbursement_email_deliveries SET state='cancelled',lease_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2", [id, token])
        } else {
          const provider = await transport({ ...stored, ...(stored.pdf ? { pdf: Buffer.from(stored.pdf, 'base64') } : { pdf: undefined }) }, `reimbursement/${id}`)
          await db.query("UPDATE reimbursement_email_deliveries SET state='sent',provider_id=$3,sent_at=now(),lease_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2", [id, token, provider])
          sent++
        }
        await db.query('COMMIT')
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      } finally { db.release() }
    } catch {
      await pool.query(`UPDATE reimbursement_email_deliveries SET state=CASE WHEN attempts>=6 OR first_attempt_at<now()-interval '23 hours' THEN 'failed' ELSE 'pending' END,
        lease_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2`, [id, token])
    }
  }
  return { sent }
}
