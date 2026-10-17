import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import type { User } from '@/payload-types'
import { canManageReimbursementSettings } from '@/lib/reimbursements/admin-access'
import { reimbursementPool } from '@/lib/reimbursements/runtime'
import { directory } from '@/lib/reimbursements/store'
import { ReimbursementSettings } from './ReimbursementSettings'

export async function ReimbursementSettingsView({ initPageResult, params }: AdminViewServerProps) {
  const { req, locale, permissions, visibleEntities } = initPageResult
  if (!await canManageReimbursementSettings(req.payload, req.user as User | null)) return null
  const { settings, categories } = await directory(await reimbursementPool())
  return <DefaultTemplate i18n={req.i18n} locale={locale} params={params} payload={req.payload} permissions={permissions} user={req.user ?? undefined} visibleEntities={visibleEntities}>
    <Gutter><ReimbursementSettings initialData={{ settings, categories }} /></Gutter>
  </DefaultTemplate>
}
