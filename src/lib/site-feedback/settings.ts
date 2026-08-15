import { getTurnstileSiteKey } from '@/lib/rock-forms/config'
import { getPayloadClient } from '@/lib/payload'
import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'

export const DEFAULT_FEEDBACK_BANNER_COPY =
  'Help us improve the new ev.church.'
export const DEFAULT_FEEDBACK_CTA_LABEL = 'Share feedback.'
export const DEFAULT_FEEDBACK_MODAL_TITLE = 'Share your feedback'
export const DEFAULT_FEEDBACK_MODAL_INTRO =
  'Tell us what is working well or what we could improve.'
export const DEFAULT_FEEDBACK_DISMISSAL_VERSION = 'v1'

export type PublicSiteFeedbackSettings = {
  bannerCopy: string
  ctaLabel: string
  modalTitle: string
  modalIntro: string
  dismissalVersion: string
  turnstileSiteKey: string
}

type FeedbackRecord = {
  enabled?: unknown
  bannerCopy?: unknown
  ctaLabel?: unknown
  modalTitle?: unknown
  modalIntro?: unknown
  dismissalVersion?: unknown
  endDate?: unknown
}

function record(value: unknown): FeedbackRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as FeedbackRecord
}

function normalizedText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

async function loadSiteFeedbackSettingsAt(
  now: Date,
): Promise<PublicSiteFeedbackSettings | null> {
  try {
    const payload = await getPayloadClient()
    const settings = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
      select: {
        feedback: {
          enabled: true,
          bannerCopy: true,
          ctaLabel: true,
          modalTitle: true,
          modalIntro: true,
          dismissalVersion: true,
          endDate: true,
        },
      },
    })) as { feedback?: unknown }
    const feedback = record(settings.feedback)
    if (!feedback || feedback.enabled !== true) return null

    if (typeof feedback.endDate === 'string' && feedback.endDate) {
      const endDate = new Date(feedback.endDate).getTime()
      if (!Number.isFinite(endDate) || endDate <= now.getTime()) return null
    }

    return {
      bannerCopy: normalizedText(
        feedback.bannerCopy,
        DEFAULT_FEEDBACK_BANNER_COPY,
      ),
      ctaLabel: normalizedText(feedback.ctaLabel, DEFAULT_FEEDBACK_CTA_LABEL),
      modalTitle: normalizedText(
        feedback.modalTitle,
        DEFAULT_FEEDBACK_MODAL_TITLE,
      ),
      modalIntro: normalizedText(
        feedback.modalIntro,
        DEFAULT_FEEDBACK_MODAL_INTRO,
      ),
      dismissalVersion: normalizedText(
        feedback.dismissalVersion,
        DEFAULT_FEEDBACK_DISMISSAL_VERSION,
      ),
      turnstileSiteKey: getTurnstileSiteKey(),
    }
  } catch {
    return null
  }
}

const getCachedSiteFeedbackSettings = unstable_cache(
  () => loadSiteFeedbackSettingsAt(new Date()),
  ['public-site-feedback-settings'],
  { tags: [CACHE_TAGS.siteSettings], revalidate: 300 },
)

export async function loadSiteFeedbackSettings(
  now?: Date,
): Promise<PublicSiteFeedbackSettings | null> {
  return now
    ? loadSiteFeedbackSettingsAt(now)
    : getCachedSiteFeedbackSettings()
}
