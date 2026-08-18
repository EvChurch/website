import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { MemberGroupSummary } from '@/lib/members/data'

import { ConnectGroupCard } from './ConnectGroupCard'

function group(overrides: Partial<MemberGroupSummary> = {}): MemberGroupSummary {
  return {
    rockGroupId: 10,
    name: 'Tuesday Central Connect',
    campusName: 'Central',
    campusSlug: 'central',
    locationName: null,
    locationAddress: null,
    isLeader: false,
    isCoached: false,
    isCoach: false,
    roleName: 'Member',
    ...overrides,
  }
}

describe('ConnectGroupCard', () => {
  it('gives the member pill stronger contrast on a white card', () => {
    const markup = renderToStaticMarkup(<ConnectGroupCard group={group()} />)

    expect(markup).toContain('>Member</span>')
    expect(markup).not.toContain('Your role')
    expect(markup).toContain('bg-warm-white')
  })

  it('shows the attendance breakdown for a led group', () => {
    const markup = renderToStaticMarkup(
      <ConnectGroupCard
        group={group({ isLeader: true, roleName: 'Leader' })}
        attendance={{
          connectGroup: { recentPercentage: 62, ytdPercentage: 66 },
          church: { recentPercentage: 60, ytdPercentage: 62 },
        }}
      />,
    )

    expect(markup).toContain('>Leader</span>')
    expect(markup).toContain('bg-rich-red')
    expect(markup).toContain('aria-label="Tuesday Central Connect attendance summary"')
    expect(markup).toContain('Last 4')
    expect(markup).toContain('YTD')
    expect(markup).toContain('62%')
    expect(markup).toContain('66%')
    expect(markup).toContain('60%')
  })

  it('uses a strong coach badge on a white card', () => {
    const markup = renderToStaticMarkup(
      <ConnectGroupCard group={group({ isCoached: true, isCoach: true, roleName: 'Coach' })} />,
    )

    expect(markup).toContain('>Coach</span>')
    expect(markup).toContain('bg-brand-black')
  })
})
