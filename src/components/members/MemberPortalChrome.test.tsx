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
  })
})
