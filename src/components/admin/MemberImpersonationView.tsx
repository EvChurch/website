import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'

import { hasExactPayloadAdminRole } from '@/access/roles'
import { searchRockAuth0MembersByEmail } from '@/auth/rock-member-directory'
import type { User } from '@/payload-types'

function emailQuery(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

export async function MemberImpersonationView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const user = initPageResult.req.user as User | null
  if (!hasExactPayloadAdminRole(user)) return null

  const query = emailQuery(searchParams?.email)
  const result = query ? await searchRockAuth0MembersByEmail(query) : null

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      user={user ?? undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div className="member-impersonation-view">
          <h1>Impersonate user</h1>
          <p>Search Rock by email for a person with an Auth0-linked login.</p>

          <form action="/admin/impersonate" className="member-impersonation-view__search" method="get">
            <label htmlFor="member-impersonation-email">Email</label>
            <div>
              <input
                autoComplete="off"
                defaultValue={query}
                id="member-impersonation-email"
                maxLength={254}
                minLength={3}
                name="email"
                placeholder="name@example.com"
                required
                type="search"
              />
              <button type="submit">Search</button>
            </div>
          </form>

          {result?.ok && result.members.length === 0 && (
            <p className="member-impersonation-view__status">
              No Auth0-linked users found for that email.
            </p>
          )}
          {result && !result.ok && (
            <p className="member-impersonation-view__status" role="alert">
              We could not search Rock right now. Try again.
            </p>
          )}
          {result?.ok && result.members.length > 0 && (
            <ul className="member-impersonation-view__results">
              {result.members.map((member) => (
                <li key={member.personId}>
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.email}</span>
                  </div>
                  <form action="/member-impersonation/start" method="post">
                    <input name="personId" type="hidden" value={member.personId} />
                    <button type="submit">Impersonate</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}
