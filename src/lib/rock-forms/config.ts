export const ROCK_FORM_PAGE_GUID =
  process.env.ROCK_FORM_PAGE_GUID || 'c58861df-2d82-4e7a-aa5b-04165d2d34c2'

export const ROCK_FORM_BLOCK_GUID =
  process.env.ROCK_FORM_BLOCK_GUID || '6fb81d5b-bea0-4b60-ab45-4876da006b1c'

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
