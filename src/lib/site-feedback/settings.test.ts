import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { loadSiteFeedbackSettings } from './settings'

vi.mock('@/lib/payload', () => ({ getPayloadClient: vi.fn() }))

describe('loadSiteFeedbackSettings', () => {
  const findGlobal = vi.fn()

  beforeEach(() => {
    vi.mocked(getPayloadClient).mockResolvedValue({ findGlobal } as never)
    findGlobal.mockReset()
  })

  it('returns normalized visitor settings using defaults for absent copy', async () => {
    findGlobal.mockResolvedValue({
      feedback: {
        enabled: true,
        bannerCopy: null,
        ctaLabel: null,
        modalTitle: 'Tell us what you think',
        modalIntro: 'Your feedback helps us improve.',
        dismissalVersion: '  v2  ',
        endDate: null,
      },
    })

    await expect(
      loadSiteFeedbackSettings(new Date('2026-08-12T12:00:00Z')),
    ).resolves.toEqual({
      bannerCopy: 'Help us improve the new ev.church.',
      ctaLabel: 'Share feedback.',
      modalTitle: 'Tell us what you think',
      modalIntro: 'Your feedback helps us improve.',
      dismissalVersion: 'v2',
      turnstileSiteKey: expect.any(String),
    })

    expect(findGlobal).toHaveBeenCalledWith({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
      select: { feedback: true },
    })
  })

  it('returns null when disabled or expired at the exact boundary', async () => {
    const now = new Date('2026-08-12T12:00:00Z')
    findGlobal.mockResolvedValue({ feedback: { enabled: false } })
    await expect(loadSiteFeedbackSettings(now)).resolves.toBeNull()

    findGlobal.mockResolvedValue({
      feedback: { enabled: true, endDate: now.toISOString() },
    })
    await expect(loadSiteFeedbackSettings(now)).resolves.toBeNull()
  })

  it('keeps a future end date eligible and fails closed on invalid data', async () => {
    findGlobal.mockResolvedValue({
      feedback: {
        enabled: true,
        endDate: '2026-08-12T12:00:01Z',
        dismissalVersion: '',
      },
    })
    await expect(
      loadSiteFeedbackSettings(new Date('2026-08-12T12:00:00Z')),
    ).resolves.toMatchObject({ dismissalVersion: 'v1' })

    findGlobal.mockResolvedValue({
      feedback: { enabled: true, endDate: 'not-a-date' },
    })
    await expect(loadSiteFeedbackSettings()).resolves.toBeNull()
  })

  it('fails closed when Payload is unavailable', async () => {
    findGlobal.mockRejectedValue(new Error('database unavailable'))
    await expect(loadSiteFeedbackSettings()).resolves.toBeNull()
  })
})
