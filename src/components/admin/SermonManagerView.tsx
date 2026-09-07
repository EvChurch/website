import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { hasSermonManagerRole } from '@/access/roles'
import { SermonManager } from './SermonManager'

export async function SermonManagerView({
  initPageResult,
  params,
}: AdminViewServerProps) {
  const { req, locale, permissions, visibleEntities } = initPageResult
  if (!hasSermonManagerRole(req.user && 'roles' in req.user ? req.user : null))
    return null
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <SermonManager />
      </Gutter>
    </DefaultTemplate>
  )
}
