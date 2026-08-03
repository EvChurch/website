import { getTurnstileSecretKey } from '@/lib/rock-forms/config'

type TurnstileResponse = {
  success: boolean
  hostname?: string
  action?: string
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
  if (!token) throw new Error('Please complete the bot check')

  const body = new URLSearchParams({
    secret: getTurnstileSecretKey(),
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
    throw new Error('The bot check expired or could not be verified')
  }
  if (
    expectedHostname &&
    result.hostname?.toLowerCase() !== expectedHostname.toLowerCase()
  ) {
    throw new Error('The bot check was issued for a different website')
  }
  if (expectedAction && result.action !== expectedAction) {
    throw new Error('The bot check was issued for a different action')
  }
}
