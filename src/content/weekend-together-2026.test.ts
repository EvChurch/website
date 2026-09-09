import { describe, expect, it } from 'vitest'
import { applyWeekendTogether2026, WEEKEND_TOGETHER_PROGRAMME } from './weekend-together-2026'
import type { Event } from '@/payload-types'

const introduction = {
  root: { type: 'root', version: 1, format: '' as const, indent: 0, direction: null,
    children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text: 'Keep this introduction' }] }] },
}
const event = {
  rockEventId: 40, slug: 'weekend-together', startDate: '2026-11-06T06:00:00.000Z',
  endDate: null, summary: introduction,
} satisfies Pick<Event, 'rockEventId' | 'slug' | 'startDate' | 'endDate' | 'summary'>

describe('Weekend Together 2026 content', () => {
  it('preserves the introduction and appends the complete chronological programme once', () => {
    const updated = applyWeekendTogether2026(event)
    expect(updated.endDate).toBe('2026-11-08T02:00:00.000Z')
    expect(updated.summary.root.children[0]).toEqual(introduction.root.children[0])
    expect(WEEKEND_TOGETHER_PROGRAMME.filter(node => node.type === 'paragraph')).toHaveLength(19)
    expect(updated.summary.root.children.slice(1).map(node => node.children[0].text)).toEqual([
      'Weekend Together programme — 6–8 November 2026', 'Friday 6 November',
      '7:00 pm — Arrival & Dessert', '8:00 pm — Session One', '9:15 pm — Board Games and chats',
      'Saturday 7 November', '8:30 am — Arrive — Coffee & Bagels', '9:15 am — Session Two',
      '10:30 am — Morning Tea', '11:00 am — Session Three', '12:30 pm — Lunch',
      '1:30 pm — Afternoon Activity', '3:00 pm — Free Time / Afternoon Tea',
      '3:45 pm — Optional organised Sports', '5:30 pm — Dinner', "6:30 pm — Kids' Games",
      '7:30 pm — Evening Programme', '9:30 pm — End', 'Sunday 8 November',
      '9:30 am — Arrive — Coffee', '10:15 am — Church Service (regular service time)',
      'Post-service — Lunch together', '3:00 pm — End — Clean up complete',
    ])
    expect(applyWeekendTogether2026(updated)).toEqual(updated)
    expect(event.summary).toEqual(introduction)
  })

  it('leaves other events and later occurrences alone', () => {
    for (const other of [{ ...event, rockEventId: 41 }, { ...event, slug: 'other' },
      { ...event, startDate: '2027-11-06T06:00:00.000Z' }, { ...event, startDate: null }]) {
      expect(applyWeekendTogether2026(other)).toBe(other)
    }
  })

  it('restores approved content when a Rock sync supplies the original description again', () => {
    expect(applyWeekendTogether2026({ ...applyWeekendTogether2026(event), summary: introduction, endDate: null }))
      .toEqual(applyWeekendTogether2026(event))
  })
})
