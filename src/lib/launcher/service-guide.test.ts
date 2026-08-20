import { beforeEach, describe, expect, it, vi } from 'vitest'

const cacheMocks = vi.hoisted(() => ({
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({
  unstable_cache: cacheMocks.unstableCache,
}))

import { getPayloadClient } from '@/lib/payload'
import {
  isCurrentlyEligible,
  isPublishedLauncherConnection,
  isPublishedLauncherWorkflow,
  loadLauncherData,
  resolveLauncherAction,
} from './service-guide'

vi.mock('@/lib/payload', () => ({ getPayloadClient: vi.fn() }))

const workflowGuid = '11111111-1111-1111-1111-111111111111'
const connectionGuid = '22222222-2222-2222-2222-222222222222'
const bannerImageGuid = '88888888-8888-8888-8888-888888888888'

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payload-1',
    rockId: 10,
    title: 'Join a group',
    content: '<p>Find <strong>community</strong></p>',
    promotionalBlurb: 'Meet people',
    bannerImageGuid: null,
    status: 1,
    startDateTime: null,
    expireDateTime: null,
    priority: 3,
    sourceOrder: 1,
    campusGuids: [{ guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }],
    campuses: [{ slug: 'north', name: 'North' }],
    directLink: null,
    workflowGuid: null,
    connectionBlockGuid: null,
    event: null,
    ...overrides,
  }
}

describe('Service Guide launcher data', () => {
  const find = vi.fn()
  const findGlobal = vi.fn()

  beforeEach(() => {
    vi.mocked(getPayloadClient).mockResolvedValue({ find, findGlobal } as never)
    find.mockReset()
    findGlobal.mockReset()
    findGlobal.mockResolvedValue({
      lastSuccessfulSyncAt: '2026-08-07T00:00:00.000Z',
    })
  })

  it('caches only the default-time catalogue with source dependency tags', () => {
    expect(cacheMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['launcher-data-with-rock-forms'],
      {
        tags: ['service-guide', 'rock-forms', 'campuses', 'events'],
        revalidate: 600,
      },
    )
  })

  it('uses inclusive starts and exclusive expiry timestamps', () => {
    const now = new Date('2026-08-07T12:00:00.000Z')
    expect(
      isCurrentlyEligible(
        record({ startDateTime: now.toISOString(), expireDateTime: null }),
        now,
      ),
    ).toBe(true)
    expect(
      isCurrentlyEligible(
        record({ expireDateTime: now.toISOString() }),
        now,
      ),
    ).toBe(false)
    expect(isCurrentlyEligible(record({ status: 0 }), now)).toBe(false)
    expect(
      isCurrentlyEligible(record({ startDateTime: 'not-a-date' }), now),
    ).toBe(false)
  })

  it('resolves the compatibility precedence and rejects unsafe direct links', () => {
    expect(
      resolveLauncherAction(
        record({
          directLink: 'https://example.test/path',
          connectionBlockGuid: connectionGuid,
          workflowGuid,
          event: { slug: 'event' },
        }),
      ),
    ).toEqual({ type: 'directLink', href: 'https://example.test/path' })
    expect(
      resolveLauncherAction(
        record({
          directLink: 'javascript:alert(1)',
          connectionBlockGuid: connectionGuid,
          workflowGuid,
        }),
      ),
    ).toEqual({ type: 'connection', blockGuid: connectionGuid })
    expect(
      resolveLauncherAction(record({ workflowGuid, event: { slug: 'event' } })),
    ).toEqual({ type: 'workflow', workflowTypeGuid: workflowGuid })
    expect(resolveLauncherAction(record({ event: { slug: 'one night' } }))).toEqual({
      type: 'event',
      href: '/events/one%20night',
    })

    expect(
      resolveLauncherAction(
        record({ directLink: 'https://www.ev.church/kids?campus=north#join' }),
      ),
    ).toEqual({ type: 'directLink', href: '/kids?campus=north#join' })
    expect(
      resolveLauncherAction(
        record({ directLink: 'https://resources.ev.church/series/romans' }),
      ),
    ).toEqual({ type: 'directLink', href: '/sermons' })
    expect(
      resolveLauncherAction(
        record({ directLink: 'https://www.ev.church.evil.test/kids' }),
      ),
    ).toEqual({
      type: 'directLink',
      href: 'https://www.ev.church.evil.test/kids',
    })

    for (const directLink of [
      '//evil.test',
      'http://ev.church/give',
      'https://user:pass@ev.church/give',
      'javascript:alert(1)',
      'https://www.ev.church/\nheader',
    ]) {
      expect(
        resolveLauncherAction(record({ directLink, content: null })),
      ).toBeNull()
    }
  })

  it('sanitizes custom content before exposing it', () => {
    expect(
      resolveLauncherAction(
        record({
          content:
            '<script>steal()</script><p style="color:red">Hello <a href="javascript:bad()">there</a></p>',
        }),
      ),
    ).toEqual({ type: 'content', html: '<p>Hello <a>there</a></p>' })
  })

  it('drops nested dangerous containers and strips attributes from allowed markup', () => {
    expect(
      resolveLauncherAction(
        record({
          content:
            '<script><script>alert(1)</script></script><svg><text>hidden</text></svg><section><p onclick="bad()">Safe <strong style="color:red">content</strong></p></section>',
        }),
      ),
    ).toEqual({
      type: 'content',
      html: '<p>Safe <strong>content</strong></p>',
    })
  })

  it('retains CTA intent without retaining Rock classes or inline styles', () => {
    expect(
      resolveLauncherAction(
        record({
          content:
            '<p><a class="link-button" style="background:hotpink" href="https://example.test/apply">Apply</a></p><p><a style="display:block" href="https://example.test/subscribe">Subscribe</a></p>',
        }),
      ),
    ).toEqual({
      type: 'content',
      html:
        '<p><a href="https://example.test/apply" data-launcher-cta="true" target="_blank" rel="noopener noreferrer nofollow">Apply</a></p><p><a href="https://example.test/subscribe" data-launcher-cta="true" target="_blank" rel="noopener noreferrer nofollow">Subscribe</a></p>',
    })
  })

  it('exposes the 16:9 banner for forms rendered in the launcher', () => {
    const imageUrl = `https://rock.ev.church/GetImage.ashx?Guid=${bannerImageGuid}&w=1200`

    expect(
      resolveLauncherAction(record({ workflowGuid, bannerImageGuid })),
    ).toEqual({ type: 'workflow', workflowTypeGuid: workflowGuid, imageUrl })
    expect(
      resolveLauncherAction(
        record({ connectionBlockGuid: connectionGuid, bannerImageGuid }),
      ),
    ).toEqual({ type: 'connection', blockGuid: connectionGuid, imageUrl })
  })

  it('removes a repeated leading title and exposes the 16:9 banner', () => {
    expect(
      resolveLauncherAction(
        record({
          title: 'Dwell',
          content: '<h2>Dwell</h2><p>Listen to Scripture every day.</p>',
          bannerImageGuid,
        }),
      ),
    ).toEqual({
      type: 'content',
      html: '<p>Listen to Scripture every day.</p>',
      imageUrl: `https://rock.ev.church/GetImage.ashx?Guid=${bannerImageGuid}&w=1200`,
    })
  })

  it('loads active records in priority, source-order, and Rock-ID order', async () => {
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'campuses') {
        return { docs: [{ slug: 'north', name: 'North' }] }
      }
      return {
        docs: [
          record({ rockId: 30, priority: 1, sourceOrder: 0, directLink: '/third' }),
          record({ rockId: 20, priority: 2, sourceOrder: 2, directLink: '/second' }),
          record({ rockId: 10, priority: 2, sourceOrder: 1, directLink: '/first' }),
          record({ rockId: 5, status: 0, directLink: '/hidden' }),
        ],
      }
    })

    await expect(loadLauncherData(new Date('2026-08-07T12:00:00Z'))).resolves.toMatchObject({
      available: true,
      campuses: [{ slug: 'north', name: 'North' }],
      items: [
        { id: '10', action: { type: 'directLink', href: '/first' } },
        { id: '20', action: { type: 'directLink', href: '/second' } },
        { id: '30', action: { type: 'directLink', href: '/third' } },
      ],
    })
  })

  it('removes campus markers from catalogue and detail titles', async () => {
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'campuses') {
        return { docs: [{ slug: 'north', name: 'North' }] }
      }
      return {
        docs: [
          record({
            title: 'Newish (NS) Connect (UC) (CT)',
            content: '<h2>Newish (NS) Connect (UC) (CT)</h2><p>Welcome.</p>',
          }),
        ],
      }
    })

    await expect(loadLauncherData()).resolves.toMatchObject({
      items: [
        {
          title: 'Newish Connect',
          action: { type: 'content', html: '<p>Welcome.</p>' },
        },
      ],
    })
  })

  it('reports an unavailable catalogue when no successful snapshot exists', async () => {
    find.mockResolvedValue({ docs: [] })
    findGlobal.mockResolvedValue({ lastSuccessfulSyncAt: null })
    await expect(loadLauncherData()).resolves.toEqual({
      available: false,
      campuses: [],
      items: [],
    })
  })

  it('loads published Payload Rock forms with URL-addressable launcher content', async () => {
    const body = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Register each child.' }],
          },
        ],
      },
    }
    findGlobal.mockResolvedValue({ lastSuccessfulSyncAt: null })
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'campuses') {
        return { docs: [{ slug: 'north', name: 'North' }] }
      }
      if (args.collection === 'rock-forms') {
        return {
          docs: [
            {
              title: 'Kids enrolment',
              slug: 'kids-enrolment',
              body,
              workflowTypeGuid: workflowGuid.toUpperCase(),
              published: true,
              image: {
                url: '/api/media/file/kids.jpg',
                sizes: { large: { url: '/api/media/file/kids-1200.jpg' } },
              },
            },
          ],
        }
      }
      return { docs: [] }
    })

    await expect(loadLauncherData()).resolves.toEqual({
      available: true,
      campuses: [{ slug: 'north', name: 'North' }],
      items: [
        {
          id: 'kids-enrolment',
          title: 'Kids enrolment',
          campusSlugs: [],
          action: {
            type: 'workflow',
            workflowTypeGuid: workflowGuid,
            imageUrl: '/api/media/file/kids-1200.jpg',
            body,
          },
        },
      ],
    })
    await expect(isPublishedLauncherWorkflow(workflowGuid)).resolves.toBe(true)
  })

  it('uses the managed Rock form when the service guide contains the same workflow', async () => {
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'campuses') return { docs: [] }
      if (args.collection === 'rock-forms') {
        return {
          docs: [
            {
              title: 'Kids enrolment',
              slug: 'kids-enrolment',
              body: null,
              workflowTypeGuid: workflowGuid,
              published: true,
              image: null,
            },
          ],
        }
      }
      return { docs: [record({ title: 'Rock service guide title', workflowGuid })] }
    })

    await expect(loadLauncherData()).resolves.toMatchObject({
      items: [
        {
          id: 'kids-enrolment',
          title: 'Kids enrolment',
          action: { type: 'workflow', workflowTypeGuid: workflowGuid },
        },
      ],
    })
  })

  it('loads a Registration site page from a published Rock Form record', async () => {
    const body = {
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Welcome.' }] }],
      },
    }
    findGlobal.mockResolvedValue({ lastSuccessfulSyncAt: null })
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'campuses') return { docs: [] }
      if (args.collection === 'rock-forms') {
        return {
          docs: [{
            title: 'Kids Enrolment',
            slug: 'kids-enrolment',
            formType: 'registrationPage',
            registrationPath: 'kids',
            body,
            image: { url: '/api/media/file/kids.jpg' },
            published: true,
          }],
        }
      }
      return { docs: [] }
    })

    await expect(loadLauncherData()).resolves.toMatchObject({
      available: true,
      items: [{
        id: 'kids-enrolment',
        title: 'Kids Enrolment',
        action: {
          type: 'registrationPage',
          href: 'https://registration.ev.church/kids',
          imageUrl: '/api/media/file/kids.jpg',
          body,
        },
      }],
    })
  })

  it('omits items and capabilities with incomplete campus resolution', async () => {
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'campuses') {
        return { docs: [{ slug: 'north', name: 'North' }] }
      }
      return {
        docs: [
          record({
            workflowGuid,
            campuses: [],
          }),
        ],
      }
    })

    await expect(loadLauncherData()).resolves.toMatchObject({ items: [] })
    await expect(isPublishedLauncherWorkflow(workflowGuid)).resolves.toBe(false)
  })

  it('allows the known Online campus alongside resolved website campuses', async () => {
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'campuses') {
        return { docs: [{ slug: 'north', name: 'North' }] }
      }
      return {
        docs: [
          record({
            title: 'PrayerMate',
            directLink: '/prayermate',
            campusGuids: [
              { guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
              { guid: '94d77e80-8a6d-4cc0-95e5-e25fbf47062f' },
            ],
          }),
        ],
      }
    })

    await expect(loadLauncherData()).resolves.toMatchObject({
      items: [{ title: 'PrayerMate', campusSlugs: ['north'] }],
    })
  })

  it('omits records assigned only to Rock non-website campuses', async () => {
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'campuses') {
        return { docs: [{ slug: 'north', name: 'North' }] }
      }
      return {
        docs: [
          record({
            title: 'Online only',
            workflowGuid,
            campuses: [],
            campusGuids: [
              { guid: '94d77e80-8a6d-4cc0-95e5-e25fbf47062f' },
            ],
          }),
        ],
      }
    })

    await expect(loadLauncherData()).resolves.toMatchObject({ items: [] })
    await expect(isPublishedLauncherWorkflow(workflowGuid)).resolves.toBe(false)
  })

  it('keeps the fixed launcher available when Payload cannot initialize', async () => {
    vi.mocked(getPayloadClient).mockRejectedValueOnce(new Error('database unavailable'))
    await expect(loadLauncherData()).resolves.toEqual({
      available: false,
      campuses: [],
      items: [],
    })
  })

  it('publishes only exact winning form actions from an eligible snapshot', async () => {
    find.mockResolvedValue({
      docs: [
        record({ workflowGuid, connectionBlockGuid: connectionGuid }),
        record({
          workflowGuid: '33333333-3333-3333-3333-333333333333',
          directLink: '/wins',
        }),
      ],
    })

    await expect(isPublishedLauncherConnection(connectionGuid)).resolves.toBe(true)
    await expect(isPublishedLauncherWorkflow(workflowGuid)).resolves.toBe(false)
    await expect(
      isPublishedLauncherWorkflow('33333333-3333-3333-3333-333333333333'),
    ).resolves.toBe(false)
    await expect(
      isPublishedLauncherWorkflow('44444444-4444-4444-4444-444444444444'),
    ).resolves.toBe(false)
  })
})
