import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  renderBlocks: vi.fn(() => null),
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

vi.mock('@/components/blocks/RenderBlocks', () => ({
  RenderBlocks: mocks.renderBlocks,
}))

import CampusPage, { generateMetadata } from './page'

const campus = {
  id: 2,
  name: 'North',
  slug: 'north',
  address: {
    street: '9-11 Rothwell Avenue',
    city: 'Rosedale, Auckland',
    postalCode: '',
  },
  description: {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'A warm community on the North Shore.' }],
        },
      ],
    },
  },
  featuredImage: null,
  slideImages: [],
  pageContent: {
    enabled: true,
    brandName: 'Ev North',
    tagline: 'Community on the Shore',
    locationLabel: 'Rosedale, Auckland',
    seoTitle: 'North Shore Church | Ev Church',
    seoDescription: 'Payload-managed North campus search description.',
    serviceDay: 'Sunday',
    serviceTimeLabel: 'Sunday 10:15 am',
    serviceOpens: '10:15',
    serviceCloses: '11:30',
    serviceDuration: 'Approximately 75 minutes',
    kidsProgram: true,
    kidsAges: 'Available for ages 1 to 12',
    heroImagePath: '/images/homepage/carousel-c645786c.jpg',
    galleryImages: [
      {
        src: '/images/homepage/carousel-3c68ddf1.jpg',
        alt: 'Families at Ev Church North',
      },
    ],
    mapUrl: 'https://www.google.com/maps?q=Rothwell+Avenue',
    parkingInfo: 'Parking is available on site.',
    ctaHeading: 'See you this Sunday',
    ctaText: 'We would love to welcome you to Ev North.',
    ctaLabel: 'Plan your visit',
    ctaHref: '/visit',
  },
  layout: [
    {
      id: 'north-events',
      blockType: 'upcomingEvents',
      heading: 'Upcoming at North',
      campusFilter: { id: 2, slug: 'north' },
    },
  ],
}

describe('Payload-managed campus page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.find.mockResolvedValue({ docs: [campus] })
  })

  it('loads the campus by slug and renders its managed content and blocks', async () => {
    const markup = renderToStaticMarkup(
      await CampusPage({ params: Promise.resolve({ slug: 'north' }) }),
    )

    expect(mocks.find).toHaveBeenCalledWith({
      collection: 'campuses',
      where: { slug: { equals: 'north' } },
      depth: 1,
      limit: 1,
      select: {
        name: true,
        slug: true,
        address: true,
        description: true,
        featuredImage: true,
        slideImages: true,
        pageContent: true,
        layout: true,
      },
    })
    expect(markup).toContain('Community on the Shore')
    expect(markup).toContain('A warm community on the North Shore.')
    expect(markup).toContain('/images/homepage/carousel-c645786c.jpg')
    expect(mocks.renderBlocks).toHaveBeenCalledWith({ blocks: campus.layout }, undefined)
  })

  it('builds campus metadata from Payload content', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'north' }),
    })

    expect(metadata.title).toEqual({ absolute: 'North Shore Church | Ev Church' })
    expect(metadata.description).toBe('Payload-managed North campus search description.')
    expect(metadata.alternates).toEqual({ canonical: 'https://ev.church/campus/north' })
  })

  it('does not publish a campus until its managed page is enabled', async () => {
    mocks.find.mockResolvedValue({
      docs: [{ ...campus, pageContent: { ...campus.pageContent, enabled: false } }],
    })

    await expect(
      CampusPage({ params: Promise.resolve({ slug: 'north' }) }),
    ).rejects.toThrow()
  })
})
