import { z } from 'zod-v3'

export const scopeLabels = {
  'reimbursements:reports:read': 'Reimbursements: read reports',
  'reimbursements:receipts:read': 'Reimbursements: read receipts and PDFs',
  'reimbursements:bank:read': 'Reimbursements: read bank details',
  'reimbursements:reports:review': 'Reimbursements: approve and reject reports',
  'reimbursements:payments:confirm': 'Reimbursements: confirm payments',
} as const
export const scopes = ['reimbursements:reports:read', 'reimbursements:receipts:read', 'reimbursements:bank:read', 'reimbursements:reports:review', 'reimbursements:payments:confirm'] as const
export type ApiScope = typeof scopes[number]
export const permissionsSchema = z.array(z.enum(scopes)).min(1).refine(values => new Set(values).size === values.length, 'Choose each permission once.')
export const expirySchema = z.string().datetime({ offset: true }).nullable().refine(value => value === null || Date.parse(value) > Date.now(), 'Choose a future expiry date.')
export const createKeySchema = z.object({ name: z.string().trim().min(1).max(120), personId: z.number().int().positive(), scopes: permissionsSchema, expiresAt: expirySchema.optional() }).strict()
export interface ApiKeySummary {
  id: string; name: string; personId: number; personName: string; personEmail: string;
  scopes: ApiScope[]; expiresAt: string | null; revokedAt: string | null; createdAt: string; lastUsedAt: string | null;
}
