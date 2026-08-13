import { afterEach, describe, expect, it, vi } from 'vitest'

import { rockFetch, rockFetchAll } from './rock-api'

describe('rockFetchAll', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches stable ordered pages until Rock returns a short page', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([{ Id: 1 }, { Id: 2 }]))
      .mockResolvedValueOnce(jsonResponse([{ Id: 3 }]))

    await expect(
      rockFetchAll<{ Id: number }>({
        endpoint: 'ContentChannelItems',
        pageSize: 2,
        getKey: (item) => item.Id,
      }),
    ).resolves.toEqual([{ Id: 1 }, { Id: 2 }, { Id: 3 }])

    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('$skip')))
      .toEqual(['0', '2'])
  })

  it('fails closed when an endpoint ignores skip and repeats a full page', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([{ Id: 1 }, { Id: 2 }]))
      .mockResolvedValueOnce(jsonResponse([{ Id: 1 }, { Id: 2 }]))

    await expect(
      rockFetchAll<{ Id: number }>({
        endpoint: 'ContentChannelItems',
        pageSize: 2,
        getKey: (item) => item.Id,
      }),
    ).rejects.toThrow('Rock pagination did not advance for ContentChannelItems')
  })
})

describe('rockFetch', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([204, 200])('accepts an empty %s response', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status }))
    await expect(rockFetch<void>({ endpoint: 'Attendances/1', method: 'PUT' })).resolves.toBeUndefined()
  })

  it('supports JSON mutation responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(42))
    await expect(rockFetch<number>({ endpoint: 'AttendanceOccurrences', method: 'POST', body: {} }))
      .resolves.toBe(42)
  })
})

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
