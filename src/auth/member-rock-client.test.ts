import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const readMemberRockConfig = vi.hoisted(() => vi.fn())

vi.mock('./member-rock-config', () => ({ readMemberRockConfig }))

import { MemberRockAPIError, memberRockFetch } from './member-rock-client'

const originalFetch = global.fetch

describe('member Rock API client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readMemberRockConfig.mockReturnValue({
      apiUrl: 'https://rock.example.test/api',
      apiKey: 'member-only-key',
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('sends an encoded no-store JSON request with the member credential', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([{ Id: 42 }]),
    )
    global.fetch = fetchMock

    await expect(
      memberRockFetch<{ Id: number }[]>({
        endpoint: '/UserLogins',
        params: { $filter: "ForeignKey eq 'auth0|member'" },
        timeoutMs: 3_000,
      }),
    ).resolves.toEqual([{ Id: 42 }])

    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toBeInstanceOf(URL)
    expect((url as URL).toString()).toBe(
      'https://rock.example.test/api/UserLogins?%24filter=ForeignKey+eq+%27auth0%7Cmember%27',
    )
    expect(options).toMatchObject({
      headers: {
        Accept: 'application/json',
        'Authorization-Token': 'member-only-key',
      },
      next: { revalidate: 0 },
    })
    expect(options?.signal).toBeInstanceOf(AbortSignal)
  })

  it('preserves an upstream status and cancels the rejected body', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream({ cancel })
    global.fetch = vi.fn(async () => new Response(body, { status: 503 }))

    const request = memberRockFetch({ endpoint: 'People/42' })

    await expect(request).rejects.toEqual(new MemberRockAPIError(503))
    expect(cancel).toHaveBeenCalledOnce()
  })
})
