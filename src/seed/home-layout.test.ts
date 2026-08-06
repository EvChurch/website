import { describe, expect, it } from 'vitest'

import { ensureServiceTimesBlock, ensureUpcomingEventsBlock } from './home-layout'

describe('ensureServiceTimesBlock', () => {
  it('places service times immediately after the hero', () => {
    const layout = ensureServiceTimesBlock([
      { blockType: 'hero' },
      { blockType: 'latestSermon' },
    ])

    expect(layout.map((block) => block.blockType)).toEqual([
      'hero',
      'serviceTimes',
      'latestSermon',
    ])
    expect(layout[1]).toMatchObject({
      heading: 'Join us this Sunday',
      services: [
        { campus: 'North', time: '10:15 am', href: '/campus/north' },
        { campus: 'Central', time: '10:15 am', href: '/campus/central' },
        { campus: 'Unichurch', time: '5:15 pm', href: '/campus/unichurch' },
      ],
    })
  })

  it('does not duplicate an existing service-times block', () => {
    const existing = [
      { blockType: 'hero' },
      { blockType: 'serviceTimes', heading: 'This Sunday' },
    ]

    expect(ensureServiceTimesBlock(existing)).toBe(existing)
  })

  it('prepends the block when the layout has no hero', () => {
    const layout = ensureServiceTimesBlock([{ blockType: 'content' }])

    expect(layout[0]?.blockType).toBe('serviceTimes')
  })
})

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
