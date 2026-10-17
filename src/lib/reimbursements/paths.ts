import { z } from 'zod-v3'

export const reimbursementViewPaths = {
  mine: '/members/reimbursements',
  approvals: '/members/reimbursements/approvals',
  payments: '/members/reimbursements/payment-queue',
  settings: '/members/reimbursements/payment-settings',
} as const
export type ReimbursementView = keyof typeof reimbursementViewPaths
export function reimbursementReportPath(id: string) {
  return `/members/reimbursements/reports/${encodeURIComponent(id)}`
}
export function reimbursementRoute(path: string[] = []): { view: ReimbursementView; reportId?: string } | null {
  if (!path.length) return { view: 'mine' }
  if (path.length === 1) {
    const entry = Object.entries(reimbursementViewPaths).find(([, href]) => href === `/members/reimbursements/${path[0]}`)
    if (entry) return { view: entry[0] as ReimbursementView }
  }
  if (path.length === 2 && path[0] === 'reports' && z.string().uuid().safeParse(path[1]).success) {
    return { view: 'mine', reportId: path[1] }
  }
  return null
}
