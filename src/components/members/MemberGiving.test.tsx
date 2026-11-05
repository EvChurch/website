import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import type { MemberGivingOverview } from '@/lib/members/giving'
import { MemberGiving } from './MemberGiving'

vi.mock('@/components/giving/GivingExperienceProvider', () => ({
  useGivingExperience: () => ({ openGiving: vi.fn() }),
}))

function overview(): MemberGivingOverview {
  return {
    recurringGifts: [], recentActivity: [],
    giftHistory: { page: 1, pageSize: 25, totalPages: 1, gifts: [] },
  }
}

describe('member gift history', () => {
  it('shows a history warning when Rock is unavailable and the member has no website giving', () => {
    const state = overview()
    state.giftHistory.rockUnavailable = true
    const html = renderToStaticMarkup(<MemberGiving initialOverview={state} />)
    expect(html).toContain('Gift history')
    expect(html).toContain('Some donations couldn’t be loaded')
    expect(html).not.toContain('any gift history yet')
  })

  it('renders a Rock donation in gift history without a recurring gift or recent activity', () => {
    const state = overview()
    state.giftHistory.gifts = [{
      id: 'rock:1', refundedMinor: null, refundPendingMinor: null, amountMinor: 5000, transactionFeeMinor: 0, frequency: '',
      giftType: 'Donation', fundName: 'General Fund', completedAt: '2026-11-02T11:00:00.000Z',
    }]
    const html = renderToStaticMarkup(<MemberGiving initialOverview={state} />)
    expect(html).toContain('Donation to General Fund')
    expect(html).toContain('3 Nov 2026')
    expect(html).toContain('$50.00')
    expect(html).toContain('No active recurring gifts')
    expect(html).not.toContain('Recent activity')
    expect(html).not.toContain('transaction fee')
  })
})
