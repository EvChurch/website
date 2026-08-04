export const ROCK_FORM_PAGE_GUID =
  process.env.ROCK_FORM_PAGE_GUID || 'f540b822-4478-411b-8f34-86876d15a1fa'

export const ROCK_FORM_BLOCK_GUID =
  process.env.ROCK_FORM_BLOCK_GUID || '62f476f9-42a7-4265-a480-be884b860fbb'

export const ROCK_FORM_CONTEXT_TTL_SECONDS = 2 * 60 * 60

export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'
export const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA'

export function getTurnstileSiteKey(): string {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  if (key) return key
  if (process.env.NODE_ENV !== 'production') return TURNSTILE_TEST_SITE_KEY

  throw new Error('NEXT_PUBLIC_TURNSTILE_SITE_KEY is required in production')
}

export function getTurnstileSecretKey(): string {
  const key = process.env.TURNSTILE_SECRET_KEY

  if (key) return key
  if (process.env.NODE_ENV !== 'production') return TURNSTILE_TEST_SECRET_KEY

  throw new Error('TURNSTILE_SECRET_KEY is required in production')
}
