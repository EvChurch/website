import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { Campus } from '@/payload-types'

vi.mock('./ManualCardGridBlockComponent', () => ({
  ManualCardGridBlockComponent: ({ priority }: { priority?: boolean }) => (
    <div data-priority={String(priority)} />
  ),
}))

vi.mock('./UpcomingEventsBlockComponent', () => ({
  UpcomingEventsBlockComponent: ({
    heading,
    campusFilter,
  }: {
    heading?: string | null
    campusFilter?: { slug?: string | null } | null
  }) => (
    <div
      data-campus={campusFilter?.slug}
      data-heading={heading}
    />
  ),
}))

import { RenderBlocks } from './RenderBlocks'

const centralCampus: Campus = {
  id: 1,
  name: 'Central',
  slug: 'central',
  rockId: 101,
  updatedAt: '2026-08-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
}

describe('RenderBlocks', () => {
  it('renders an upcoming-events block with its campus filter', () => {
    const markup = renderToStaticMarkup(
      <RenderBlocks
        blocks={[
          {
            blockType: 'upcomingEvents',
            heading: 'Central events',
            campusFilter: centralCampus,
          },
        ]}
      />,
    )

    expect(markup).toContain('data-campus="central"')
    expect(markup).toContain('data-heading="Central events"')
  })
})
