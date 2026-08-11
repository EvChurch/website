import { describe, expect, it, vi } from 'vitest'

import type { Payload } from 'payload'

import type { Campus } from '@/payload-types'

import {
  buildCampusSeedUpdate,
  CAMPUS_PAGE_DEFAULTS,
  ensureCampusPageDefaults,
} from './campus-pages'

function campus(overrides: Partial<Campus> = {}): Campus {
  return {
    id: 2,
    name: 'North',
    slug: 'north',
    rockId: 102,
    updatedAt: '2026-08-06T00:00:00.000Z',
    createdAt: '2026-08-06T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildCampusSeedUpdate', () => {
  it('folds the managed campus migration defaults into a missing campus page', () => {
    const update = buildCampusSeedUpdate(campus())

    expect(update).toMatchObject({
      address: {
        street: '9-11 Rothwell Avenue',
        city: 'Rosedale, Auckland',
      },
      pageContent: {
        enabled: true,
        brandName: 'Ev North',
        kidsAges: 'Available for ages 1 to 12',
        mapUrl: CAMPUS_PAGE_DEFAULTS.north.pageContent.mapUrl,
      },
    })
    expect(update?.pageContent?.galleryImages).toHaveLength(4)
    expect(update?.pageContent?.actions).toEqual([
      expect.objectContaining({ label: 'Get directions' }),
      expect.objectContaining({ href: '/campus/north/calendar.ics' }),
    ])
    expect(update?.layout).toEqual([
      expect.objectContaining({
        blockType: 'upcomingEvents',
        campusFilter: 2,
      }),
    ])
  })

  it('updates an old seeded map URL without overwriting editorial campus content', () => {
    const update = buildCampusSeedUpdate(
      campus({
        address: {
          street: 'Editor street',
          city: 'Editor city',
          postalCode: '9999',
        },
        pageContent: {
          ...CAMPUS_PAGE_DEFAULTS.north.pageContent,
          tagline: 'Editor tagline',
          mapUrl:
            'https://www.google.com/maps?q=9-11+Rothwell+Avenue+Rosedale+Auckland',
        },
        layout: [
          {
            blockType: 'upcomingEvents',
            heading: 'Editor events heading',
          },
        ],
      }),
    )

    expect(update).not.toHaveProperty('address')
    expect(update?.pageContent?.tagline).toBe('Editor tagline')
    expect(update?.pageContent?.mapUrl).toBe(
      CAMPUS_PAGE_DEFAULTS.north.pageContent.mapUrl,
    )
    expect(update).not.toHaveProperty('layout')
  })

  it('preserves a custom managed map URL', () => {
    const customMapUrl = 'https://www.google.com/maps?q=Editor-selected-location'
    const update = buildCampusSeedUpdate(
      campus({
        pageContent: {
          ...CAMPUS_PAGE_DEFAULTS.north.pageContent,
          mapUrl: customMapUrl,
        },
      }),
    )

    expect(update).not.toHaveProperty('pageContent')
  })

  it('upgrades only the legacy kids ages while preserving other managed content', () => {
    const update = buildCampusSeedUpdate(
      campus({
        pageContent: {
          ...CAMPUS_PAGE_DEFAULTS.north.pageContent,
          tagline: 'Editor tagline',
          kidsAges: 'Available for ages 0 to 12',
        },
      }),
    )

    expect(update?.pageContent?.kidsAges).toBe('Available for ages 1 to 12')
    expect(update?.pageContent?.tagline).toBe('Editor tagline')
  })

  it('preserves custom kids availability wording', () => {
    const update = buildCampusSeedUpdate(
      campus({
        pageContent: {
          ...CAMPUS_PAGE_DEFAULTS.north.pageContent,
          kidsAges: 'Creche through Year 6',
        },
      }),
    )

    expect(update).not.toHaveProperty('pageContent')
  })

  it('does not replace a legacy URL belonging to another campus', () => {
    const centralLegacyUrl =
      'https://www.google.com/maps?q=80+Olsen+Avenue+Hillsborough+Auckland'
    const update = buildCampusSeedUpdate(
      campus({
        pageContent: {
          ...CAMPUS_PAGE_DEFAULTS.north.pageContent,
          mapUrl: centralLegacyUrl,
        },
      }),
    )

    expect(update).not.toHaveProperty('pageContent')
  })

  it('skips a campus that already matches the seeded defaults', () => {
    const existing = campus()
    const firstUpdate = buildCampusSeedUpdate(existing)

    expect(firstUpdate).not.toBeNull()
    expect(buildCampusSeedUpdate({ ...existing, ...firstUpdate })).toBeNull()
  })

  it('preserves editorial content and publish state for a disabled campus page', () => {
    const update = buildCampusSeedUpdate(
      campus({
        pageContent: {
          ...CAMPUS_PAGE_DEFAULTS.north.pageContent,
          enabled: false,
          tagline: 'Temporarily unpublished by an editor',
        },
      }),
    )

    expect(update).not.toHaveProperty('pageContent')
  })

  it('fully initializes a page group that contains only Payload defaults', () => {
    const update = buildCampusSeedUpdate(
      campus({
        pageContent: {
          enabled: false,
          serviceDay: 'Sunday',
          serviceDuration: 'Approximately 75 minutes',
          kidsProgram: false,
          galleryImages: [],
          ctaHeading: 'See you this Sunday',
          ctaLabel: 'Plan your visit',
          ctaHref: '/visit',
        },
      }),
    )

    expect(update?.pageContent).toMatchObject({
      enabled: true,
      brandName: 'Ev North',
      tagline: 'Community on the Shore',
      mapUrl: CAMPUS_PAGE_DEFAULTS.north.pageContent.mapUrl,
    })
  })
})

describe('ensureCampusPageDefaults', () => {
  it('queries only seed-owned fields and updates a campus that needs defaults', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [campus()] })
    const update = vi.fn().mockResolvedValue({})

    await ensureCampusPageDefaults({ find, update } as unknown as Payload)

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'campuses',
        depth: 0,
        select: {
          slug: true,
          address: true,
          description: true,
          pageContent: true,
          layout: true,
        },
      }),
    )
    expect(update).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'campuses',
        id: 2,
        data: expect.objectContaining({
          pageContent: expect.objectContaining({ brandName: 'Ev North' }),
        }),
      }),
    )
  })

  it('does not write a campus that already matches the defaults', async () => {
    const existing = campus()
    const seeded = { ...existing, ...buildCampusSeedUpdate(existing) }
    const find = vi.fn().mockResolvedValue({ docs: [seeded] })
    const update = vi.fn()

    await ensureCampusPageDefaults({ find, update } as unknown as Payload)

    expect(update).not.toHaveBeenCalled()
  })
})
