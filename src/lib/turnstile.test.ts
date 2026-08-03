import { afterEach, describe, expect, it, vi } from 'vitest'

import { TurnstileVerificationError, verifyTurnstileToken } from './turnstile'

vi.mock('@/lib/rock-forms/config', () => ({
  getTurnstileSecretKey: () => 'turnstile-secret',
}))

describe('verifyTurnstileToken', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the siteverify request and accepts the expected hostname and action', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        hostname: 'www.ev.church',
        action: 'rock-connection-submit',
      }), { headers: { 'content-type': 'application/json' } }),
    )

    await expect(verifyTurnstileToken({
      token: 'visitor-token',
      remoteIp: '192.0.2.1',
      expectedHostname: 'WWW.EV.CHURCH',
      expectedAction: 'rock-connection-submit',
    })).resolves.toBeUndefined()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(options).toMatchObject({ method: 'POST', cache: 'no-store' })
    expect(String(options?.body)).toBe(
      'secret=turnstile-secret&response=visitor-token&remoteip=192.0.2.1',
    )
  })

  it.each([
    ['failed verification', { success: false }, {}],
    ['wrong hostname', { success: true, hostname: 'other.example', action: 'expected' }, { expectedHostname: 'ev.church', expectedAction: 'expected' }],
    ['wrong action', { success: true, hostname: 'ev.church', action: 'other' }, { expectedHostname: 'ev.church', expectedAction: 'expected' }],
  ])('rejects a %s response', async (_name, result, expected) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(result), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(verifyTurnstileToken({ token: 'token', ...expected }))
      .rejects.toBeInstanceOf(TurnstileVerificationError)
  })

  it('rejects an empty token before calling Cloudflare', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(verifyTurnstileToken({ token: '' }))
      .rejects.toBeInstanceOf(TurnstileVerificationError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
