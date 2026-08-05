import { describe, expect, it } from 'vitest'

import { ensureUpcomingEventsBlock } from './home-layout'

describe('ensureUpcomingEventsBlock', () => {
  it('places upcoming events immediately after the latest sermon', () => {
    const layout = ensureUpcomingEventsBlock([
      { blockType: 'hero' },
      { blockType: 'latestSermon' },
      { blockType: 'content' },
    ])

    expect(layout.map((block) => block.blockType)).toEqual([
      'hero',
      'latestSermon',
      'upcomingEvents',
      'content',
    ])
    expect(layout[2]).toMatchObject({
      eyebrow: 'What’s on',
      heading: 'Upcoming events',
    })
  })

  it('does not duplicate an existing upcoming-events block', () => {
    const existing = [
      { blockType: 'latestSermon' },
      { blockType: 'upcomingEvents', heading: 'This week' },
    ]

    expect(ensureUpcomingEventsBlock(existing)).toBe(existing)
  })

  it('appends the block when the layout has no latest sermon', () => {
    const layout = ensureUpcomingEventsBlock([{ blockType: 'hero' }])

    expect(layout.at(-1)?.blockType).toBe('upcomingEvents')
  })
})
