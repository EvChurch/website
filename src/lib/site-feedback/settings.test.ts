import { beforeEach, describe, expect, it, vi } from 'vitest'

const cacheMocks = vi.hoisted(() => ({
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({
  unstable_cache: cacheMocks.unstableCache,
}))

import { getPayloadClient } from '@/lib/payload'
import { loadSiteFeedbackSettings } from './settings'

vi.mock('@/lib/payload', () => ({ getPayloadClient: vi.fn() }))

describe('loadSiteFeedbackSettings', () => {
  const findGlobal = vi.fn()

  beforeEach(() => {
    vi.mocked(getPayloadClient).mockResolvedValue({ findGlobal } as never)
    findGlobal.mockReset()
  })

  it('caches public launcher settings', () => {
    expect(cacheMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['public-launcher-feedback-settings'],
      { tags: ['site-settings'], revalidate: 300 },
    )
  })

  it('returns normalized visitor settings using defaults for absent copy', async () => {
    findGlobal.mockResolvedValue({
      feedback: {
        enabled: true,
        notificationRecipient: 'private-recipient@ev.church',
        modalTitle: 'Tell us what you think',
        modalIntro: 'Your feedback helps us improve.',
        endDate: null,
      },
    })

    await expect(
      loadSiteFeedbackSettings(),
    ).resolves.toEqual({
      modalTitle: 'Tell us what you think',
      modalIntro: 'Your feedback helps us improve.',
      turnstileSiteKey: expect.any(String),
    })

    expect(findGlobal).toHaveBeenCalledWith({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
      select: {
        feedback: {
          modalTitle: true,
          modalIntro: true,
        },
      },
    })
    expect(JSON.stringify(await loadSiteFeedbackSettings())).not.toContain(
      'private-recipient@ev.church',
    )
  })

  it.each([
    { enabled: false },
    { enabled: true, endDate: '2020-01-01T00:00:00Z' },
    { enabled: true, endDate: 'not-a-date' },
    undefined,
  ])('keeps feedback available regardless of legacy banner settings: %j', async (feedback) => {
    findGlobal.mockResolvedValue({ feedback })
    await expect(loadSiteFeedbackSettings()).resolves.toMatchObject({
      modalTitle: 'Share your feedback',
      modalIntro: 'Tell us what is working well or what we could improve.',
    })
  })

  it('fails closed when Payload is unavailable', async () => {
    findGlobal.mockRejectedValue(new Error('database unavailable'))
    await expect(loadSiteFeedbackSettings()).resolves.toBeNull()
  })
})
