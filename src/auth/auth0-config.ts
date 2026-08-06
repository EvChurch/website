export interface Auth0RuntimeConfig {
  appBaseUrl: string
  clientId: string
  clientSecret: string
  domain: string
  issuer: string
  secret: string
}

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value || /change-me|replace-me|generate-with/i.test(value)) {
    throw new Error(`Missing or placeholder ${name}`)
  }
  return value
}

export function readAuth0Config(): Auth0RuntimeConfig {
  const rawDomain = required('AUTH0_DOMAIN')
  const domain = rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!domain || domain.includes('/') || !domain.includes('.')) {
    throw new Error('Invalid AUTH0_DOMAIN')
  }

  const appBaseUrl = new URL(required('APP_BASE_URL'))
  if (appBaseUrl.pathname !== '/' || appBaseUrl.search || appBaseUrl.hash) {
    throw new Error('APP_BASE_URL must be an origin')
  }
  if (process.env.NODE_ENV === 'production' && appBaseUrl.protocol !== 'https:') {
    throw new Error('APP_BASE_URL must use HTTPS in production')
  }

  const secret = required('AUTH0_SECRET')
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error('AUTH0_SECRET must be 32 bytes encoded as 64 hex characters')
  }

  return {
    appBaseUrl: appBaseUrl.origin,
    clientId: required('AUTH0_CLIENT_ID'),
    clientSecret: required('AUTH0_CLIENT_SECRET'),
    domain,
    issuer: `https://${domain}/`,
    secret,
  }
}
