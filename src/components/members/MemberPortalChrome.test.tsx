import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { memberConnectGroupHref, MemberPortalChrome } from './MemberPortalChrome'

describe('MemberPortalChrome', () => {
  it('targets the detail route only when there is exactly one group', () => {
    expect(memberConnectGroupHref([])).toBe('/members/connect-groups')
    expect(memberConnectGroupHref([{ rockGroupId: 10 }])).toBe('/members/connect-groups/10')
    expect(memberConnectGroupHref([{ rockGroupId: 10 }, { rockGroupId: 20 }])).toBe('/members/connect-groups')
  })

  it('uses the singular Connect Group menu label', () => {
    const markup = renderToStaticMarkup(
      <MemberPortalChrome
        active="groups"
        member={{ name: 'Aroha Ngata', email: 'aroha@example.com', avatarUrl: null }}
        canAccessLeaderResources={false}
        connectGroupHref="/members/connect-groups/10"
      >
        <p>Content</p>
      </MemberPortalChrome>,
    )

    const link = markup.match(/<a[^>]+href="\/members\/connect-groups\/10"[^>]*>([\s\S]*?)<\/a>/u)
    const linkText = link?.[1].replace(/<[^>]+>/gu, '')

    expect(linkText).toBe('Connect Group')
    expect(markup).toContain('href="/members/daily-readings"')
    expect(markup).toContain('Daily Reading')
    expect(markup).toContain('href="/members/giving"')
    expect(markup).toContain('Giving')
    expect(markup).toContain('href="/members/my-service"')
    expect(markup).toContain('My Service')
    expect(markup).toContain('href="/members"')
    expect(markup).toContain('Overview')
    expect(markup).toContain('Study Resources')
    expect(markup).not.toContain('Leader Resources')
    expect(markup.match(/rel="nofollow"/gu)).toHaveLength(6)
  })

  it('marks My Service active only for the service section', () => {
    const markup = renderToStaticMarkup(
      <MemberPortalChrome
        active="service"
        member={{ name: 'Aroha Ngata', email: 'aroha@example.com', avatarUrl: null }}
        canAccessLeaderResources
        connectGroupHref="/members/connect-groups"
      >
        <p>Content</p>
      </MemberPortalChrome>,
    )

    expect(markup).toMatch(/<a[^>]+aria-current="page"[^>]+href="\/members\/my-service"/u)
    expect(markup).not.toMatch(/<a[^>]+aria-current="page"[^>]+href="\/members"/u)
    expect(markup).toContain('Study Resources')

    const labels = [...markup.matchAll(/<a[^>]*rel="nofollow"[^>]*>([\s\S]*?)<\/a>/gu)]
      .map((match) => match[1]?.replace(/<[^>]+>/gu, ''))
    expect(labels).toEqual([
      'Overview',
      'Daily Reading',
      'Connect Group',
      'Study Resources',
      'My Service',
      'Giving',
    ])
  })
})
