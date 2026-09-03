import {
  getTurnstileSecretKey,
  TURNSTILE_TEST_SECRET_KEY,
} from '@/lib/rock-forms/config'

type TurnstileResponse = {
  success: boolean
  hostname?: string
  action?: string
}

export class TurnstileVerificationError extends Error {}

function invalidTurnstile(message: string): never {
  throw new TurnstileVerificationError(message)
}

export async function verifyTurnstileToken({
  token,
  remoteIp,
  expectedHostname,
  expectedAction,
}: {
  token: string
  remoteIp?: string | null
  expectedHostname?: string | null
  expectedAction?: string | null
}): Promise<void> {
  if (!token) invalidTurnstile('Please complete the bot check')

  const secret = getTurnstileSecretKey()
  const body = new URLSearchParams({
    secret,
    response: token,
    ...(remoteIp ? { remoteip: remoteIp } : {}),
  })
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    },
  )
  const result = (await response.json()) as TurnstileResponse

  if (!result.success) {
    invalidTurnstile('The bot check expired or could not be verified')
  }
  const usingTestKey = secret === TURNSTILE_TEST_SECRET_KEY
  if (
    expectedHostname &&
    result.hostname?.toLowerCase() !== expectedHostname.toLowerCase() &&
    !usingTestKey
  ) {
    invalidTurnstile('The bot check was issued for a different website')
  }
  if (expectedAction && result.action !== expectedAction && !usingTestKey) {
    invalidTurnstile('The bot check was issued for a different action')
  }
}
