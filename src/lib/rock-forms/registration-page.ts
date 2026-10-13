export const REGISTRATION_SITE_ORIGIN = 'https://registration.ev.church'

const REGISTRATION_PAGE_PATH =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/

const RESERVED_REGISTRATION_PAGE_PREFIXES = new Set([
  'admin',
  'api',
  'auth',
  'blockproperties',
  'login',
  'logout',
  'page',
  'pageproperties',
  'pages',
  'secure',
])

export function validateRegistrationPagePath(value: unknown): true | string {
  if (
    typeof value !== 'string' ||
    value.length > 128 ||
    !REGISTRATION_PAGE_PATH.test(value) ||
    RESERVED_REGISTRATION_PAGE_PREFIXES.has(value.split('/', 1)[0])
  ) {
    return 'Enter a safe Registration site path using lowercase letters, numbers, hyphens, and forward slashes.'
  }
  return true
}

export function registrationPageHref(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (validateRegistrationPagePath(value) !== true) return null
  return new URL(`/${value}`, REGISTRATION_SITE_ORIGIN).toString()
}
