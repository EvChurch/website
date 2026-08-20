import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  renderBlocks: vi.fn(() => null),
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({ unstable_cache: mocks.unstableCache }))

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
  geoPoint: {
    lat: -36.751087,
    lng: 174.699985,
  },
  googlePlaceId: 'ChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U',
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
    kidsAges: 'Available for ages 0 to 12',
    heroImagePath: '/images/homepage/carousel-c645786c.jpg',
    galleryImages: [
      {
        src: '/images/homepage/carousel-3c68ddf1.jpg',
        alt: 'Families at Ev Church North',
      },
    ],
    mapUrl: 'https://www.google.com/maps/place/?q=place_id%3Amanaged-map-value',
    parkingInfo: 'Parking is available on site.',
    actions: [
      {
        label: 'Get directions',
        href:
          'https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U',
        variant: 'primary',
        external: true,
      },
      {
        label: 'Save service time',
        href: '/campus/north/calendar.ics',
        variant: 'secondary',
        external: false,
      },
    ],
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
    mocks.find.mockReset()
    mocks.renderBlocks.mockClear()
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key')
    mocks.find.mockResolvedValue({ docs: [campus] })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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
        geoPoint: true,
        googlePlaceId: true,
        description: true,
        featuredImage: true,
        slideImages: true,
        pageContent: true,
        layout: true,
      },
    })
    expect(markup).toContain('Community on the Shore')
    expect(markup).toContain('A warm community on the North Shore.')
    expect(markup).toContain('/_next/image?url=%2Fimages%2Fhomepage%2Fcarousel-c645786c.jpg')
    expect(markup).toMatch(/<img[^>]+fetchPriority="high"/)
    expect(markup).toMatch(/<img[^>]+loading="eager"/)
    const galleryImageTag = markup.match(/<img[^>]+carousel-3c68ddf1\.jpg[^>]*>/)?.[0]
    expect(galleryImageTag).toContain('loading="lazy"')
    expect(markup).toContain('/_next/image?url=%2Fimages%2Fhomepage%2Fcarousel-3c68ddf1.jpg')
    expect(markup).toContain(
      'src="https://www.google.com/maps/embed/v1/place?key=test-api-key&amp;q=place_id%3Amanaged-map-value"',
    )
    expect(markup).toContain('title="Map showing Ev North"')
    expect(markup).toContain('href="#campus-map"')
    expect(markup).toContain('id="campus-map"')
    expect(markup).not.toContain('Google Maps embed will be placed here')
    expect(markup).toContain('Available for ages 0 to 12')
    expect(markup).toContain('Get directions')
    expect(markup).toContain('Visited Ev North?')
    expect(markup).toContain('Your honest feedback can help others know what to expect')
    expect(markup).toContain('Share your experience on Google')
    expect(markup).toContain(
      'href="https://search.google.com/local/writereview?placeid=ChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U"',
    )
    expect(markup).not.toContain('Message us')
    expect(markup).toContain('Save service time')
    expect(markup).toContain('/campus/north/calendar.ics')
    expect(markup).toContain('"latitude":-36.751087')
    expect(markup).toContain('"longitude":174.699985')
    expect(markup).toContain(
      '"hasMap":"https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U"',
    )
    expect(mocks.renderBlocks).toHaveBeenCalledWith({ blocks: campus.layout }, undefined)
  })

  it('builds campus metadata from Payload content', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'north' }),
    })

    expect(metadata.title).toEqual({ absolute: 'North Shore Church | Ev Church' })
    expect(metadata.description).toBe('Payload-managed North campus search description.')
    expect(metadata.alternates).toEqual({ canonical: 'https://www.ev.church/campus/north' })
  })

  it.each([
    'not a URL',
    'https://example.com/maps?q=Rothwell+Avenue',
    'http://www.google.com/maps?q=Rothwell+Avenue',
    'https://www.google.com/maps/place/Auckland',
  ])('uses an HTTPS address fallback for an unsafe managed map URL: %s', async (mapUrl) => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          ...campus,
          googlePlaceId: null,
          pageContent: { ...campus.pageContent, mapUrl },
        },
      ],
    })

    const markup = renderToStaticMarkup(
      await CampusPage({ params: Promise.resolve({ slug: 'north' }) }),
    )

    expect(markup).toContain(
      'src="https://www.google.com/maps?q=9-11+Rothwell+Avenue%2C+Rosedale%2C+Auckland&amp;output=embed"',
    )
    expect(markup).not.toContain(`"hasMap":"${mapUrl}"`)
    expect(markup).not.toContain('Share your experience on Google')
  })

  it('does not publish a campus until its managed page is enabled', async () => {
    mocks.find.mockResolvedValue({
      docs: [{ ...campus, pageContent: { ...campus.pageContent, enabled: false } }],
    })

    await expect(
      CampusPage({ params: Promise.resolve({ slug: 'north' }) }),
    ).rejects.toThrow()
  })

  it('uses the managed brand without adding a campus-specific prefix', async () => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          ...campus,
          name: 'Unichurch',
          slug: 'unichurch',
          pageContent: { ...campus.pageContent, brandName: 'Unichurch' },
        },
      ],
    })

    const markup = renderToStaticMarkup(
      await CampusPage({ params: Promise.resolve({ slug: 'unichurch' }) }),
    )

    expect(markup).toContain('>Unichurch</span>')
    expect(markup).not.toContain('Ev Unichurch')
  })

  it('uses the tagged campus source cache and a long ISR fallback', () => {
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['managed-campus-by-slug'],
      { tags: ['campuses', 'pages'], revalidate: 86_400 },
    )

    const source = readFileSync(
      join(process.cwd(), 'src/app/(frontend)/campus/[slug]/page.tsx'),
      'utf8',
    )
    expect(source).toContain('export const revalidate = 86400')
    expect(source).not.toContain("export const dynamic = 'force-dynamic'")
  })
})
