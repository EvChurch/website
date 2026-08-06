import { readAuth0Config } from './auth0-config'

export function isTrustedAuthRequest(headers: Headers) {
  const origin = headers.get('origin')
  if (origin) {
    try {
      if (new URL(origin).origin !== readAuth0Config().appBaseUrl) return false
    } catch {
      return false
    }
  }

  const fetchSite = headers.get('sec-fetch-site')
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none'
}
