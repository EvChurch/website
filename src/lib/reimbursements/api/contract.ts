import { z } from 'zod-v3'

export type { ApiScope } from '@/lib/api/contract'
export const versionSchema = z.number().int().positive()
export const reviewSchema = z.object({ version: versionSchema, reason: z.string().max(2000).default('') }).strict()
export const rejectSchema = reviewSchema.extend({ reason: z.string().trim().min(1).max(2000), rejectedLineIds: z.array(z.string().uuid()).max(100).default([]) })
export const paymentsSchema = z.object({ reports: z.array(z.object({ id: z.string().uuid(), version: versionSchema }).strict()).min(1).max(100) }).strict()
