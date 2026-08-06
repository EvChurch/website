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

vi.mock('./ServiceTimesBlockComponent', () => ({
  ServiceTimesBlockComponent: ({
    heading,
    services,
  }: {
    heading?: string | null
    services: Array<{ campus: string; time: string; href: string }>
  }) => (
    <div
      data-heading={heading}
      data-services={services.map((service) => service.campus).join(',')}
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
  it('renders a service-times block with its configured services', () => {
    const markup = renderToStaticMarkup(
      <RenderBlocks
        blocks={[
          {
            blockType: 'serviceTimes',
            heading: 'This Sunday',
            services: [
              { campus: 'North', time: '10:15 am', href: '/campus/north' },
              { campus: 'Unichurch', time: '5:15 pm', href: '/campus/unichurch' },
            ],
          },
        ]}
      />,
    )

    expect(markup).toContain('data-heading="This Sunday"')
    expect(markup).toContain('data-services="North,Unichurch"')
  })

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
