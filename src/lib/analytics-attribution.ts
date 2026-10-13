import { canTrackAnalyticsPath } from './analytics-privacy'

const PRODUCTION_ORIGIN = 'https://www.ev.church'
const CAMPAIGN_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term'] as const
const CLICK_FIELDS = ['gclid', 'dclid', 'gbraid', 'wbraid'] as const
const SERVICE_REFERRERS = new Set([
  'accounts.google.com',
  'secure.blinkpay.co.nz',
  'sandbox.secure.blinkpay.co.nz',
  'dev-xc16stsw52lzt8sa.us.auth0.com',
])

export function getAnalyticsPageContext(href: string, referrer: string) {
  const url = new URL(href)
  if (url.origin !== PRODUCTION_ORIGIN || !canTrackAnalyticsPath(url.pathname)) return null

  const location = new URL(url.pathname, PRODUCTION_ORIGIN)
  for (const key of CAMPAIGN_FIELDS) {
    const value = url.searchParams.get(key)
    // Campaign labels only: no URLs, email addresses, arbitrary query data or fragments.
    if (value && /^[\p{L}\p{N} _.-]{1,100}$/u.test(value)) location.searchParams.set(key, value)
  }
  for (const key of CLICK_FIELDS) {
    const value = url.searchParams.get(key)
    if (value && /^[A-Za-z0-9_-]{1,256}$/.test(value)) location.searchParams.set(key, value)
  }

  let referrerOrigin = ''
  let serviceReturn = false
  try {
    const previous = new URL(referrer)
    if (previous.protocol === 'https:' || previous.protocol === 'http:') {
      referrerOrigin = `${previous.origin}/`
      serviceReturn = SERVICE_REFERRERS.has(previous.hostname)
    }
  } catch {
    // A direct visit has no referrer.
  }

  return {
    page_location: location.href,
    page_path: url.pathname,
    page_referrer: referrerOrigin,
    // Google treats even ignore_referrer=false as an instruction to ignore it.
    ...(serviceReturn ? { ignore_referrer: true as const } : {}),
  }
}
