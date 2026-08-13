export const MAX_FEEDBACK_COMMENT_LENGTH = 4_000
export const MAX_FEEDBACK_EMAIL_LENGTH = 254
export const MAX_FEEDBACK_SOURCE_URL_LENGTH = 2_048
export const MAX_FEEDBACK_TURNSTILE_TOKEN_LENGTH = 4_096
export const MAX_POSTHOG_SESSION_ID_LENGTH = 64
export const MAX_POSTHOG_REPLAY_URL_LENGTH = 2_048

export type ValidPostHogReplay = {
  sessionId: string
  url: string
}

export function parsePostHogReplayUrl(
  value: unknown,
  postHogUiHost = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
  postHogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
): ValidPostHogReplay | null {
  if (
    typeof value !== 'string' ||
    !value ||
    !postHogUiHost ||
    !postHogProjectToken
  ) {
    return null
  }
  if (value.length > MAX_POSTHOG_REPLAY_URL_LENGTH) return null
  try {
    const replayUrl = new URL(value)
    const expectedPostHogOrigin = new URL(postHogUiHost).origin
    const replayPathSegments = replayUrl.pathname.split('/').filter(Boolean)
    const sessionId = replayPathSegments.at(-1) || ''
    const timestamp = replayUrl.searchParams.get('t')
    if (
      replayUrl.protocol !== 'https:' ||
      replayUrl.origin !== expectedPostHogOrigin ||
      replayUrl.username ||
      replayUrl.password ||
      replayUrl.hash ||
      replayPathSegments.length !== 4 ||
      replayPathSegments[0] !== 'project' ||
      replayPathSegments[1] !== postHogProjectToken ||
      replayPathSegments[2] !== 'replay' ||
      !sessionId ||
      sessionId.length > MAX_POSTHOG_SESSION_ID_LENGTH ||
      !/^[a-zA-Z0-9-]+$/.test(sessionId) ||
      replayUrl.searchParams.size !== 1 ||
      timestamp === null ||
      !/^\d+$/.test(timestamp)
    ) {
      return null
    }
    return {
      sessionId,
      url: `${expectedPostHogOrigin}/project/${encodeURIComponent(postHogProjectToken)}/replay/${encodeURIComponent(sessionId)}?t=${timestamp}`,
    }
  } catch {
    return null
  }
}

const ALLOWED_KEYS = new Set([
  'comment',
  'email',
  'sourceUrl',
  'postHogReplayUrl',
  'website',
  'turnstileToken',
])

const EMAIL_PATTERN =
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i

export type ValidSiteFeedbackSubmission = {
  comment: string
  email: string
  sourceUrl: string
  postHogSessionId?: string
  postHogReplayUrl?: string
  turnstileToken: string
}

export class SiteFeedbackValidationError extends Error {
  constructor() {
    super('Invalid feedback submission')
  }
}

function invalid(): never {
  throw new SiteFeedbackValidationError()
}

function boundedString(
  value: unknown,
  maximum: number,
  required: boolean,
): string {
  if (typeof value !== 'string' || value.length > maximum) invalid()
  const normalized = value.trim()
  if (required && !normalized) invalid()
  return normalized
}

export function validateSiteFeedbackSubmission(
  value: unknown,
  trustedOrigin: string,
  postHogUiHost = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
  postHogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
): ValidSiteFeedbackSubmission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()

  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !ALLOWED_KEYS.has(key))) invalid()

  const comment = boundedString(
    input.comment,
    MAX_FEEDBACK_COMMENT_LENGTH,
    true,
  )
  const email = boundedString(input.email, MAX_FEEDBACK_EMAIL_LENGTH, true)
  if (!EMAIL_PATTERN.test(email)) invalid()

  const rawSourceUrl = boundedString(
    input.sourceUrl,
    MAX_FEEDBACK_SOURCE_URL_LENGTH,
    true,
  )
  let sourceUrl: URL
  let expectedOrigin: string
  try {
    sourceUrl = new URL(rawSourceUrl)
    expectedOrigin = new URL(trustedOrigin).origin
  } catch {
    invalid()
  }
  if (
    !['http:', 'https:'].includes(sourceUrl.protocol) ||
    sourceUrl.origin !== expectedOrigin
  ) {
    invalid()
  }

  const website = boundedString(input.website ?? '', 256, false)
  if (website) invalid()
  const turnstileToken = boundedString(
    input.turnstileToken,
    MAX_FEEDBACK_TURNSTILE_TOKEN_LENGTH,
    true,
  )

  const rawPostHogReplayUrl = boundedString(
    input.postHogReplayUrl ?? '',
    MAX_POSTHOG_REPLAY_URL_LENGTH,
    false,
  )
  const postHogReplay = rawPostHogReplayUrl
    ? parsePostHogReplayUrl(
        rawPostHogReplayUrl,
        postHogUiHost,
        postHogProjectToken,
      )
    : null
  if (rawPostHogReplayUrl && !postHogReplay) invalid()

  return {
    comment,
    email,
    sourceUrl: sourceUrl.href,
    ...(postHogReplay
      ? {
          postHogSessionId: postHogReplay.sessionId,
          postHogReplayUrl: postHogReplay.url,
        }
      : {}),
    turnstileToken,
  }
}
