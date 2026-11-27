import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MemberPortalChrome } from '@/components/members/MemberPortalChrome'
import { CourseShell } from './CourseShell'

function navigation(markup: string) {
  return markup.match(/<nav\b[\s\S]*?<\/nav>/u)?.[0].replace(/_R_[^"]+_/gu, 'navigation-id')
}

describe('CourseShell', () => {
  it('uses the complete member navigation with Courses active and the mobile menu', () => {
    const courseNavigation = navigation(renderToStaticMarkup(<CourseShell><p>Course</p></CourseShell>))
    const memberNavigation = navigation(renderToStaticMarkup(
      <MemberPortalChrome active="courses" member={{ name: 'Aroha', email: 'aroha@example.com', avatarUrl: null }} canAccessLeaderResources={false} connectGroupHref="/members/connect-groups">
        <p>Member</p>
      </MemberPortalChrome>,
    ))

    expect(courseNavigation).toBe(memberNavigation)
    expect(courseNavigation).toContain('Member menu')
    expect(courseNavigation).toMatch(/<a[^>]+aria-current="page"[^>]+href="\/members\/courses"/u)
  })
})
