export const MAX_FEEDBACK_COMMENT_LENGTH = 4_000
export const MAX_FEEDBACK_EMAIL_LENGTH = 254
export const MAX_FEEDBACK_SOURCE_URL_LENGTH = 2_048
export const MAX_FEEDBACK_TURNSTILE_TOKEN_LENGTH = 4_096

const ALLOWED_KEYS = new Set([
  'comment',
  'email',
  'sourceUrl',
  'website',
  'turnstileToken',
])

const EMAIL_PATTERN =
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i

export type ValidSiteFeedbackSubmission = {
  comment: string
  email?: string
  sourceUrl: string
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
): ValidSiteFeedbackSubmission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()

  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !ALLOWED_KEYS.has(key))) invalid()

  const comment = boundedString(
    input.comment,
    MAX_FEEDBACK_COMMENT_LENGTH,
    true,
  )
  const email = boundedString(input.email ?? '', MAX_FEEDBACK_EMAIL_LENGTH, false)
  if (email && !EMAIL_PATTERN.test(email)) invalid()

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

  return {
    comment,
    ...(email ? { email } : {}),
    sourceUrl: sourceUrl.href,
    turnstileToken,
  }
}
