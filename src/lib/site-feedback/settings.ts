import { getTurnstileSiteKey } from '@/lib/rock-forms/config'
import { getPayloadClient } from '@/lib/payload'
import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'

export const DEFAULT_FEEDBACK_MODAL_TITLE = 'Share your feedback'
export const DEFAULT_FEEDBACK_MODAL_INTRO =
  'Tell us what is working well or what we could improve.'

export type PublicSiteFeedbackSettings = {
  modalTitle: string
  modalIntro: string
  turnstileSiteKey: string
}

type FeedbackRecord = {
  modalTitle?: unknown
  modalIntro?: unknown
}

function record(value: unknown): FeedbackRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as FeedbackRecord
}

function normalizedText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

async function fetchSiteFeedbackSettings(): Promise<PublicSiteFeedbackSettings | null> {
  try {
    const payload = await getPayloadClient()
    const settings = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
      select: {
        feedback: {
          modalTitle: true,
          modalIntro: true,
        },
      },
    })) as { feedback?: unknown }
    // Feedback is a permanent launcher action; legacy banner scheduling does not apply.
    const feedback = record(settings.feedback) ?? {}

    return {
      modalTitle: normalizedText(
        feedback.modalTitle,
        DEFAULT_FEEDBACK_MODAL_TITLE,
      ),
      modalIntro: normalizedText(
        feedback.modalIntro,
        DEFAULT_FEEDBACK_MODAL_INTRO,
      ),
      turnstileSiteKey: getTurnstileSiteKey(),
    }
  } catch {
    return null
  }
}

const getCachedSiteFeedbackSettings = unstable_cache(
  fetchSiteFeedbackSettings,
  ['public-launcher-feedback-settings'],
  { tags: [CACHE_TAGS.siteSettings], revalidate: 300 },
)

export async function loadSiteFeedbackSettings(): Promise<PublicSiteFeedbackSettings | null> {
  return getCachedSiteFeedbackSettings()
}
