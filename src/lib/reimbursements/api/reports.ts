import { createHash } from 'node:crypto'
import type { Pool } from 'pg'
import { z } from 'zod-v3'
import { approvalPerson, type Report } from '../model'
import { directory, reportFromRow, reportPermissions, type ReportRow } from '../store'
import { ApiError } from '@/lib/api/keys'
import type { Principal } from './principal'

type Database = Pick<Pool, 'query'>
export async function findReport(db: Database, principal: Principal, id: string) {
  const context = await directory(db)
  const row = (await db.query<ReportRow>('SELECT * FROM reimbursement_reports WHERE id=$1',[id])).rows[0]
  const report = row && reportFromRow(row)
  if (!report || !reportPermissions(principal.actor,report,context.centres,context.settings).visible) throw new ApiError('not_found','Report not found.',404)
  return { report, permissions: reportPermissions(principal.actor,report,context.centres,context.settings), context }
}
export function reportData(report: Report, principal: Principal, permissions: ReturnType<typeof reportPermissions>) {
  const canReadBank = permissions.bank && principal.key.scopes.includes('reimbursements:bank:read')
  const canReadReceipts = principal.key.scopes.includes('reimbursements:receipts:read')
  const base = `/api/v1/reimbursements/reports/${report.id}`
  return {
    id: report.id, number: report.number, status: report.status, version: report.version, revision: report.revision,
    claimant: { id: report.claimantId, name: report.claimantName, email: report.claimantEmail },
    campus: { id: report.campusId ?? null, name: report.campusName ?? '' }, purpose: { id: report.centreId, name: report.centreName },
    currency: 'NZD', totalMinor: report.lines.reduce((sum,line) => sum+(line.amountMinor ?? 0),0),
    bankAccount: canReadBank ? { name: report.accountName, number: report.accountNumber } : null,
    expenses: report.lines.map(line => ({ id: line.id, date: line.date, categoryId: line.categoryId, categoryName: line.categoryName ?? '', expenseReason: line.description, amountMinor: line.amountMinor, hasGst: line.hasGst, receiptUrl: canReadReceipts && line.receiptHash ? `${base}/receipts/${line.id}` : null })),
    // Explicitly serialize history so submission snapshots cannot bypass attachment/bank scopes.
    history: report.history.map(item => ({ at: item.at, personId: item.personId, name: item.name, action: item.action, reason: item.reason, revision: item.revision, apiKey: item.apiKey ?? null, rejectedLines: item.rejectedLines?.map(line => ({ id: line.id, number: line.number, expenseReason: line.description })) ?? [] })),
    permissions: { review: (permissions.approveRC || permissions.approveFinance) && principal.key.scopes.includes('reimbursements:reports:review'), confirmPayment: permissions.payment && principal.key.scopes.includes('reimbursements:payments:confirm') },
    pdfUrl: canReadReceipts ? `${base}/pdf` : null, createdAt: report.createdAt, updatedAt: report.updatedAt,
  }
}
export async function authorizeReview(db: Database, principal: Principal, id: string) {
  const result = await findReport(db,principal,id)
  const { actor } = principal
  const assigned = approvalPerson(result.context.centres.find(centre => centre.id === result.report.centreId),result.report.claimantId,result.context.settings)
  if (actor.personId === result.report.claimantId || (!actor.finance && assigned?.id !== actor.personId)) throw new ApiError('forbidden','You are not an eligible approver.',403)
}
const statuses = ['draft','rc-approval','finance-approval','rejected','awaiting-payment','paid','cancelled'] as const
const querySchema = z.object({ status: z.enum(statuses).optional(), updatedSince: z.string().datetime({offset:true}).optional(), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().max(2048).optional() }).strict()
const cursorSchema = z.object({ at: z.string().datetime({offset:true}), id: z.string().uuid(), until: z.string().datetime({offset:true}), filter: z.string() }).strict()
export async function listReports(db: Database, principal: Principal, params: URLSearchParams) {
  if (new Set(params.keys()).size !== [...params.keys()].length) throw new ApiError('invalid_request','Query parameters must not be repeated.',400)
  const query = querySchema.parse(Object.fromEntries(params))
  const filter = createHash('sha256').update(JSON.stringify([query.status ?? null,query.updatedSince ?? null])).digest('hex')
  let cursor: z.infer<typeof cursorSchema> | undefined
  if (query.cursor) {
    try { cursor = cursorSchema.parse(JSON.parse(Buffer.from(query.cursor,'base64url').toString())); if (cursor.filter!==filter) throw new Error('filter') }
    catch { throw new ApiError('invalid_cursor','Use the returned cursor with the same filters.',400) }
  }
  const until = cursor?.until ?? (await db.query<{ at: string }>(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at`)).rows[0].at
  const { actor } = principal
  const context = await directory(db)
  const direct = context.centres.filter(centre => !centre.financeOnly && centre.approverRockPersonId===actor.personId).map(centre => centre.id)
  const fallback = context.centres.filter(centre => !centre.financeOnly && centre.approverRockPersonId && approvalPerson(centre,centre.approverRockPersonId,context.settings)?.id===actor.personId)
  const values: unknown[] = [actor.personId,actor.finance,direct,query.status ?? null,query.updatedSince ?? null,until,cursor?.at ?? null,cursor?.id ?? null,query.limit+1]
  const fallbackConditions = fallback.map(centre => { values.push(centre.id,centre.approverRockPersonId); return `(centre_id=$${values.length-1} AND claimant_id=$${values.length})` })
  const result = await db.query<ReportRow & { cursor_at: string }>(`SELECT *,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at FROM reimbursement_reports
    WHERE (claimant_id=$1 OR (status<>'draft' AND ($2::boolean OR centre_id=ANY($3::int[]) ${fallbackConditions.map(condition => `OR ${condition}`).join(' ')})))
    AND ($4::text IS NULL OR status=$4) AND ($5::timestamptz IS NULL OR updated_at>=$5) AND updated_at<=$6
    AND ($7::timestamptz IS NULL OR (updated_at,id)>($7::timestamptz,$8::uuid)) ORDER BY updated_at,id LIMIT $9`,values)
  const rows = result.rows.slice(0,query.limit)
  const last = rows.at(-1)
  return { data: rows.map(row => { const report = reportFromRow(row); return reportData(report,principal,reportPermissions(actor,report,context.centres,context.settings)) }),
    nextCursor: result.rows.length>query.limit && last ? Buffer.from(JSON.stringify({ at: last.cursor_at,id:last.id,until,filter })).toString('base64url') : null, syncUntil: until }
}
