import { z } from 'zod-v3'
import { BANK_ACCOUNT_PATTERN, BANK_ACCOUNT_FORMAT_MESSAGE, isBankAccountNumber } from '@/lib/bank-account'

export const statuses = ['draft', 'rc-approval', 'finance-approval', 'awaiting-payment', 'rejected', 'paid', 'cancelled'] as const
export type ReportStatus = typeof statuses[number]
export const statusLabels: Record<ReportStatus, string> = {
  draft: 'Draft', 'rc-approval': 'Awaiting purpose approval', 'finance-approval': 'Awaiting finance approval',
  'awaiting-payment': 'Awaiting payment', rejected: 'Rejected', paid: 'Paid', cancelled: 'Cancelled',
}
export const actionLabels: Record<string, string> = { submit: 'Submitted', approve: 'Approved', reject: 'Rejected', withdraw: 'Returned to draft', cancel: 'Cancelled', archive: 'Archived', restore: 'Restored to active reports', return: 'Returned for changes', paid: 'Payment recorded' }
export const lineSchema = z.object({
  id: z.string().uuid(), date: z.string().max(10), categoryId: z.number().int().positive().nullable(),
  description: z.string().max(2000), amountMinor: z.number().int().min(0).max(100_000_000).nullable(),
  hasGst: z.boolean(), receiptHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  categoryName: z.string().max(120).optional(),
})
export const paymentProfileSchema = z.object({
  accountName: z.string().trim().min(1).max(200),
  accountNumber: z.string().regex(new RegExp(`^${BANK_ACCOUNT_PATTERN}$`), BANK_ACCOUNT_FORMAT_MESSAGE),
})
export function hasPaymentSettings(profile: { accountName: string; accountNumber: string }) {
  return paymentProfileSchema.safeParse(profile).success
}
export const draftSchema = z.object({
  centreId: z.number().int().positive().nullable(),
  lines: z.array(lineSchema).max(100),
  payoutOverride: z.object({
    accountName: z.string().max(200), accountNumber: paymentProfileSchema.shape.accountNumber,
  }).nullable().optional(),
}).superRefine((draft, ctx) => {
  if (new Set(draft.lines.map(line => line.id)).size !== draft.lines.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Line identifiers must be unique' })
  }
})
export type ExpenseLine = z.infer<typeof lineSchema>
export type Draft = z.infer<typeof draftSchema>
export interface Actor { personId: number; name: string; email: string; admin: boolean; finance: boolean }
export interface Category { id: number; name: string; archived: boolean }
export interface Centre { id: number; name: string; approverRockPersonId: number | null; approverName: string | null; approverEmail: string | null; financeOnly?: boolean }
export interface Settings { seniorPersonId: number | null; seniorName: string; seniorEmail: string; alternatePersonId: number | null; alternateName: string; alternateEmail: string; financeEmail: string }
export interface Activity { at: string; personId: number; name: string; action: string; reason: string; revision: number; snapshot?: { centreName: string; lines: ExpenseLine[] } }
export interface Report extends Draft {
  id: string; number: number; claimantId: number; claimantName: string; claimantEmail: string;
  status: ReportStatus; version: number; revision: number; history: Activity[];
  rcApproverId: number | null; centreName: string; createdAt: string; updatedAt: string;
  accountName: string; accountNumber: string;
}
export function isArchivedReport(report: Pick<Report, 'status' | 'history'>) {
  return [...report.history].reverse().find(item => ['archive', 'restore', 'reject', 'return', 'submit'].includes(item.action))?.action === 'archive'
}
export function canArchiveReport(report: Pick<Report, 'status' | 'history'>) {
  return ['draft', 'rc-approval', 'finance-approval', 'rejected'].includes(report.status) && !isArchivedReport(report)
}
export function isOlderReport(report: Pick<Report, 'status' | 'history'>) {
  return report.status === 'paid' || report.status === 'cancelled' || isArchivedReport(report)
}
export function gstMinor(amountMinor: number, hasGst: boolean) {
  return hasGst ? Math.round(amountMinor * 15 / 115) : 0
}
export function money(value: number) { return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(value / 100) }
export function parseMoney(value: string): number | null {
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return amount <= 100_000_000 ? amount : null
}
export function reportNumber(number: number) { return `EXP-${String(number).padStart(6, '0')}` }
export function approvalPerson(centre: Centre | undefined, claimantId: number, settings: Settings) {
  if (centre?.financeOnly) return null
  if (!centre?.approverRockPersonId) return null
  if (centre.approverRockPersonId !== claimantId) return { id: centre.approverRockPersonId, name: centre.approverName || '', email: centre.approverEmail || '' }
  const fallback = settings.seniorPersonId === claimantId
    ? { id: settings.alternatePersonId, name: settings.alternateName, email: settings.alternateEmail }
    : { id: settings.seniorPersonId, name: settings.seniorName, email: settings.seniorEmail }
  return fallback.id && fallback.id !== claimantId ? { ...fallback, id: fallback.id } : null
}
export function validateSubmission(draft: Draft, categories: Category[], profile: { accountName: string; accountNumber: string }): string[] {
  const errors: string[] = []
  if (!draft.centreId) errors.push('Choose a purpose.')
  if (!profile.accountName.trim()) errors.push('Enter the payout bank account holder name.')
  if (!isBankAccountNumber(profile.accountNumber)) errors.push(BANK_ACCOUNT_FORMAT_MESSAGE)
  if (!draft.lines.length) errors.push('Add at least one expense.')
  draft.lines.forEach((line, index) => {
    const prefix = `Line ${index + 1}: `
    const date = new Date(`${line.date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(line.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== line.date) errors.push(prefix + 'choose a valid date.')
    if (!categories.some(category => category.id === line.categoryId && !category.archived)) errors.push(prefix + 'choose an active category.')
    if (!line.description.trim()) errors.push(prefix + 'enter a description.')
    if (!line.amountMinor || line.amountMinor < 1) errors.push(prefix + 'enter an amount greater than zero.')
    if (!line.receiptHash) errors.push(prefix + 'upload a receipt.')
  })
  return errors
}
