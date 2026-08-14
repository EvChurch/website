import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const search = vi.hoisted(() => vi.fn())

vi.mock('@/auth/rock-member-directory', () => ({
  searchRockAuth0MembersByEmail: search,
}))
vi.mock('@payloadcms/next/templates', () => ({
  DefaultTemplate: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@payloadcms/ui', () => ({
  Gutter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { MemberImpersonationView } from './MemberImpersonationView'

function props(roles: string[], email?: string) {
  return {
    initPageResult: {
      req: { user: { roles }, payload: {}, i18n: {} },
      visibleEntities: { collections: [], globals: [] },
      permissions: {},
    },
    searchParams: email ? { email } : {},
  } as never
}

describe('Payload member impersonation view', () => {
  beforeEach(() => search.mockReset())

  it('renders nothing and never searches for non-admin roles', async () => {
    for (const roles of [[], ['editor'], ['content-lead']]) {
      expect(await MemberImpersonationView(props(roles, 'alex@example.com'))).toBeNull()
    }
    expect(search).not.toHaveBeenCalled()
  })

  it('searches by email and renders validated targets for exact admins', async () => {
    search.mockResolvedValue({
      ok: true,
      members: [{
        personId: 42,
        name: 'Alex Member',
        email: 'alex@example.com',
        photoUrl: null,
      }],
    })

    const markup = renderToStaticMarkup(
      await MemberImpersonationView(props(['admin'], 'alex@example.com')),
    )

    expect(search).toHaveBeenCalledWith('alex@example.com')
    expect(markup).toContain('Impersonate user')
    expect(markup).toContain('Alex Member')
    expect(markup).toContain('alex@example.com')
    expect(markup).toContain('action="/member-impersonation/start"')
    expect(markup).toContain('name="personId" value="42"')
  })

  it('renders no-result and private upstream-failure states', async () => {
    search.mockResolvedValueOnce({ ok: true, members: [] })
    const empty = renderToStaticMarkup(
      await MemberImpersonationView(props(['admin'], 'none@example.com')),
    )
    expect(empty).toContain('No Auth0-linked users found')

    search.mockResolvedValueOnce({ ok: false, reason: 'upstream-unavailable' })
    const failed = renderToStaticMarkup(
      await MemberImpersonationView(props(['admin'], 'alex@example.com')),
    )
    expect(failed).toContain('could not search Rock')
    expect(failed).not.toContain('upstream-unavailable')
  })
})
