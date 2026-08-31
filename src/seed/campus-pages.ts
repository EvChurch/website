import type { Payload } from 'payload'
import { isDeepStrictEqual } from 'node:util'

import type { Campus } from '@/payload-types'

type SeedCampus = Pick<
  Campus,
  'id' | 'slug' | 'address' | 'description' | 'pageContent' | 'layout'
>

type CampusSeedUpdate = Partial<
  Pick<Campus, 'address' | 'description' | 'pageContent' | 'layout'>
>

interface CampusDefaults {
  address: NonNullable<Campus['address']>
  description: string
  pageContent: NonNullable<Campus['pageContent']>
}

type CampusSlug = 'north' | 'central' | 'unichurch'

const LEGACY_MAP_URL_BY_CAMPUS: Record<CampusSlug, string> = {
  north: 'https://www.google.com/maps?q=9-11+Rothwell+Avenue+Rosedale+Auckland',
  central: 'https://www.google.com/maps?q=80+Olsen+Avenue+Hillsborough+Auckland',
  unichurch: 'https://www.google.com/maps?q=24+Princes+Street+Auckland',
}

export const CAMPUS_PAGE_DEFAULTS = {
  north: {
    address: {
      street: '9-11 Rothwell Avenue',
      city: 'Rosedale, Auckland',
      postalCode: '',
    },
    description:
      'Ev North is located in Rosedale on the North Shore, serving families and individuals across the wider Shore community. We are a warm, welcoming church with a heart for people at every stage of life. Our services are relaxed and family-friendly, with excellent programs for kids of all ages.',
    pageContent: {
      enabled: true,
      brandName: 'Ev North',
      tagline: 'Community on the Shore',
      locationLabel: 'Rosedale, Auckland',
      seoTitle: 'North Campus | Ev Church Auckland',
      seoDescription:
        'Join Ev North at 9-11 Rothwell Avenue, Rosedale, Auckland. Services every Sunday 10:15 am. A welcoming community in Rosedale, Auckland.',
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
          alt: 'Families at Ev Church North campus Rosedale Auckland',
        },
        {
          src: '/images/homepage/carousel-168f386e.jpg',
          alt: 'Community at Ev Church North Shore Auckland',
        },
        {
          src: '/images/homepage/carousel-9a8d8943.jpg',
          alt: 'Live worship at Ev Church North Rosedale Auckland',
        },
        {
          src: '/images/homepage/carousel-70ac2785.jpg',
          alt: 'Sunday gathering at Ev Church North campus Auckland',
        },
      ],
      mapUrl:
        'https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U',
      parkingInfo:
        'Parking is available on site. If you need any help finding us, feel free to get in touch.',
      actions: [
        {
          label: 'Get directions',
          href: 'https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U',
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
      ctaText:
        'We would love to welcome you to Ev North. Come as you are. Everyone has a place here.',
      ctaLabel: 'Plan your visit',
      ctaHref: '/visit',
    },
  },
  central: {
    address: {
      street: '80 Olsen Avenue',
      city: 'Hillsborough, Auckland',
      postalCode: '',
    },
    description:
      'Ev Central meets in Hillsborough, south-central Auckland. We are a diverse, vibrant community of people from all walks of life. Whether you live nearby or are visiting, you are welcome here. Our Sunday services feature live worship, an engaging message, and genuine community.',
    pageContent: {
      enabled: true,
      brandName: 'Ev Central',
      tagline: 'In the heart of the city',
      locationLabel: 'Hillsborough, Auckland',
      seoTitle: 'Central Campus | Ev Church Auckland',
      seoDescription:
        'Join Ev Central at 80 Olsen Avenue, Hillsborough, Auckland. Services every Sunday 10:15 am. A welcoming community in Hillsborough, Auckland.',
      serviceDay: 'Sunday',
      serviceTimeLabel: 'Sunday 10:15 am',
      serviceOpens: '10:15',
      serviceCloses: '11:30',
      serviceDuration: 'Approximately 75 minutes',
      kidsProgram: true,
      kidsAges: 'Available for ages 1 to 12',
      heroImagePath: '/images/campus-central/photo-3b4be562.jpg',
      galleryImages: [
        {
          src: '/images/campus-central/photo-9018bc8d.jpg',
          alt: 'Live worship at Ev Church Central campus in Hillsborough Auckland',
        },
        {
          src: '/images/campus-central/photo-c1a8d4f7.jpg',
          alt: 'Community gathering at Ev Church Central Auckland',
        },
        {
          src: '/images/campus-central/photo-e85b8b0f.jpg',
          alt: 'People connecting at Ev Church Central Hillsborough',
        },
        {
          src: '/images/campus-central/photo-f38f53fe.jpg',
          alt: 'Sunday service gathering at Ev Church Central Auckland',
        },
      ],
      mapUrl:
        'https://www.google.com/maps/place/?q=place_id%3AChIJAYvdBVVGDW0ReTxTjSRowE8',
      parkingInfo:
        'Parking is available on site. If you need any help finding us, feel free to get in touch.',
      actions: [
        {
          label: 'Get directions',
          href: 'https://www.google.com/maps/place/?q=place_id%3AChIJAYvdBVVGDW0ReTxTjSRowE8',
          variant: 'primary',
          external: true,
        },
        {
          label: 'Save service time',
          href: '/campus/central/calendar.ics',
          variant: 'secondary',
          external: false,
        },
      ],
      ctaHeading: 'See you this Sunday',
      ctaText:
        'We would love to welcome you to Ev Central. Come as you are. Everyone has a place here.',
      ctaLabel: 'Plan your visit',
      ctaHref: '/visit',
    },
  },
  unichurch: {
    address: {
      street: '24 Princes Street',
      city: 'Auckland',
      postalCode: '1010',
    },
    description:
      'Unichurch is our campus expression specifically for university students. Meeting on Sunday evenings, it is the perfect way to end your weekend and start your week. If you are a student at the University of Auckland or any tertiary institution in the city, this is your community. Expect relaxed vibes, real conversations, and a space to explore faith.',
    pageContent: {
      enabled: true,
      brandName: 'Unichurch',
      tagline: 'Faith on campus',
      locationLabel: 'University of Auckland',
      seoTitle: 'Unichurch | Student Church Auckland | University of Auckland',
      seoDescription:
        'Join Unichurch at the University of Auckland. A student church for university and tertiary students in Auckland. Sunday 5:15 pm.',
      serviceDay: 'Sunday',
      serviceTimeLabel: 'Sunday 5:15 pm',
      serviceOpens: '17:15',
      serviceCloses: '18:30',
      serviceDuration: 'Approximately 75 minutes',
      kidsProgram: false,
      kidsAges: null,
      heroImagePath: '/images/campus-unichurch/photo-3cb597b9.jpg',
      galleryImages: [
        {
          src: '/images/campus-unichurch/photo-4e451abd.jpg',
          alt: 'University students at Unichurch Auckland',
        },
        {
          src: '/images/campus-unichurch/photo-af1c0355.jpg',
          alt: 'Worship at Unichurch student church Auckland',
        },
        {
          src: '/images/campus-unichurch/photo-be476efc.jpg',
          alt: 'Student community at Unichurch University of Auckland',
        },
        {
          src: '/images/campus-unichurch/photo-d912efee.jpg',
          alt: 'Sunday evening gathering at Unichurch Auckland',
        },
      ],
      mapUrl:
        'https://www.google.com/maps/place/?q=place_id%3AChIJVxR51PxHDW0RGv02V7ClS-o',
      parkingInfo:
        'Parking is available on site. If you need any help finding us, feel free to get in touch.',
      actions: [
        {
          label: 'Get directions',
          href: 'https://www.google.com/maps/place/?q=place_id%3AChIJVxR51PxHDW0RGv02V7ClS-o',
          variant: 'primary',
          external: true,
        },
        {
          label: 'Save service time',
          href: '/campus/unichurch/calendar.ics',
          variant: 'secondary',
          external: false,
        },
      ],
      ctaHeading: 'See you this Sunday',
      ctaText:
        'We would love to welcome you to Unichurch. Come as you are. Everyone has a place here.',
      ctaLabel: 'Plan your visit',
      ctaHref: '/visit',
    },
  },
} satisfies Record<CampusSlug, CampusDefaults>

function campusDescription(text: string): NonNullable<Campus['description']> {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text,
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          textFormat: 0,
          textStyle: '',
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim())
}

const LEGACY_KIDS_AGES = 'Available for ages 0 to 12'

function hasManagedPageContent(pageContent: Campus['pageContent']): boolean {
  if (!pageContent) return false
  if (pageContent.enabled) return true

  const textFields = [
    pageContent.brandName,
    pageContent.tagline,
    pageContent.locationLabel,
    pageContent.seoTitle,
    pageContent.seoDescription,
    pageContent.serviceTimeLabel,
    pageContent.serviceOpens,
    pageContent.serviceCloses,
    pageContent.kidsAges,
    pageContent.heroImagePath,
    pageContent.mapUrl,
    pageContent.parkingInfo,
    pageContent.ctaText,
  ]

  return (
    textFields.some(hasText) ||
    Boolean(pageContent.galleryImages?.length) ||
    Boolean(pageContent.actions?.length) ||
    (hasText(pageContent.serviceDay) && pageContent.serviceDay !== 'Sunday') ||
    (hasText(pageContent.serviceDuration) &&
      pageContent.serviceDuration !== 'Approximately 75 minutes') ||
    pageContent.kidsProgram === true ||
    (hasText(pageContent.ctaHeading) && pageContent.ctaHeading !== 'See you this Sunday') ||
    (hasText(pageContent.ctaLabel) && pageContent.ctaLabel !== 'Plan your visit') ||
    (hasText(pageContent.ctaHref) && pageContent.ctaHref !== '/visit')
  )
}

export function buildCampusSeedUpdate(campus: SeedCampus): CampusSeedUpdate | null {
  const slug = campus.slug as CampusSlug
  const defaults = CAMPUS_PAGE_DEFAULTS[slug]
  if (!defaults) return null

  const currentMapUrl = campus.pageContent?.mapUrl
  const shouldUseDefaultMap =
    !hasText(currentMapUrl) || currentMapUrl === LEGACY_MAP_URL_BY_CAMPUS[slug]
  const pageContent = hasManagedPageContent(campus.pageContent)
    ? {
        ...campus.pageContent,
        mapUrl: shouldUseDefaultMap ? defaults.pageContent.mapUrl : currentMapUrl,
        kidsAges:
          campus.pageContent?.kidsAges === LEGACY_KIDS_AGES
            ? defaults.pageContent.kidsAges
            : campus.pageContent?.kidsAges,
      }
    : defaults.pageContent

  const layout = campus.layout ?? []
  const hasUpcomingEvents = layout.some((block) => block.blockType === 'upcomingEvents')

  const candidate: CampusSeedUpdate = {
    address: {
      street: hasText(campus.address?.street)
        ? campus.address.street
        : defaults.address.street,
      city: hasText(campus.address?.city) ? campus.address.city : defaults.address.city,
      postalCode: hasText(campus.address?.postalCode)
        ? campus.address.postalCode
        : defaults.address.postalCode,
    },
    description: campus.description ?? campusDescription(defaults.description),
    pageContent,
    layout: hasUpcomingEvents
      ? layout
      : [
          ...layout,
          {
            blockType: 'upcomingEvents',
            eyebrow: 'What’s on',
            heading: 'Upcoming events',
            campusFilter: campus.id,
          },
        ],
  }

  const update: CampusSeedUpdate = {}
  for (const field of ['address', 'description', 'pageContent', 'layout'] as const) {
    if (!isDeepStrictEqual(candidate[field], campus[field])) {
      Object.assign(update, { [field]: candidate[field] })
    }
  }

  return Object.keys(update).length > 0 ? update : null
}

export async function ensureCampusPageDefaults(payload: Payload): Promise<void> {
  const result = await payload.find({
    collection: 'campuses',
    where: {
      slug: {
        in: Object.keys(CAMPUS_PAGE_DEFAULTS),
      },
    },
    depth: 0,
    limit: 10,
    select: {
      slug: true,
      address: true,
      description: true,
      pageContent: true,
      layout: true,
    },
  })

  await Promise.all(
    result.docs.map(async (campus) => {
      const data = buildCampusSeedUpdate(campus)
      if (!data) return

      await payload.update({
        collection: 'campuses',
        id: campus.id,
        data,
        context: { skipCacheInvalidation: true },
      })
    }),
  )
}
