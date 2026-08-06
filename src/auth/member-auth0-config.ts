import { readMemberRockConfig } from './member-rock-config'

export interface MemberAuth0RuntimeConfig {
  appBaseUrl: string
  clientId: string
  clientSecret: string
  domain: string
  issuer: string
  secret: string
}

const placeholder = /change-me|replace-me|generate-with/i

function requiredMemberSetting(name: string) {
  const value = process.env[name]?.trim()
  if (!value || placeholder.test(value)) {
    throw new Error(`Missing or placeholder ${name}`)
  }
  return value
}

export function readMemberAuth0Config(): MemberAuth0RuntimeConfig {
  const rawDomain = requiredMemberSetting('MEMBER_AUTH0_DOMAIN')
  const domain = rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d+)?$/i.test(domain)) {
    throw new Error('Invalid MEMBER_AUTH0_DOMAIN')
  }

  const appBaseUrl = new URL(requiredMemberSetting('MEMBER_AUTH0_APP_BASE_URL'))
  if (
    (appBaseUrl.protocol !== 'https:' && appBaseUrl.protocol !== 'http:') ||
    appBaseUrl.pathname !== '/' ||
    appBaseUrl.search ||
    appBaseUrl.hash ||
    appBaseUrl.username ||
    appBaseUrl.password
  ) {
    throw new Error('MEMBER_AUTH0_APP_BASE_URL must be an origin')
  }
  if (process.env.NODE_ENV === 'production' && appBaseUrl.protocol !== 'https:') {
    throw new Error('MEMBER_AUTH0_APP_BASE_URL must use HTTPS in production')
  }

  const secret = requiredMemberSetting('MEMBER_AUTH0_SECRET')
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error(
      'MEMBER_AUTH0_SECRET must be 32 bytes encoded as 64 hex characters',
    )
  }

  return {
    appBaseUrl: appBaseUrl.origin,
    clientId: requiredMemberSetting('MEMBER_AUTH0_CLIENT_ID'),
    clientSecret: requiredMemberSetting('MEMBER_AUTH0_CLIENT_SECRET'),
    domain,
    issuer: `https://${domain}/`,
    secret,
  }
}

export function readMemberAuthConfiguration() {
  return {
    auth0: readMemberAuth0Config(),
    rock: readMemberRockConfig(),
  }
}

/**
 * Member auth is enabled only when both isolated upstream boundaries validate.
 * Invalid or partial optional configuration must not break anonymous pages.
 */
export function isMemberAuthEnabled() {
  try {
    readMemberAuthConfiguration()
    return true
  } catch {
    return false
  }
}

export const memberAuthEnabled = isMemberAuthEnabled
