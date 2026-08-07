import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const readMemberRockConfig = vi.hoisted(() => vi.fn())
vi.mock('./member-rock-config', () => ({ readMemberRockConfig }))

import { fetchMemberRockFile } from './member-rock-file'

const originalFetch = global.fetch
const validGuid = '11111111-1111-4111-8111-111111111111'

describe('member Rock file client', () => {
  beforeEach(() => {
    readMemberRockConfig.mockReturnValue({
      apiUrl: 'https://rock.example.test/api',
      apiKey: 'member-only-key',
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('fetches a bounded supported file directly from Rock', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'application/pdf', 'content-length': '3' },
    }))
    global.fetch = fetchMock

    await expect(fetchMemberRockFile(validGuid)).resolves.toEqual({
      body: new Uint8Array([1, 2, 3]),
      contentType: 'application/pdf',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(`https://rock.example.test/GetFile.ashx?Guid=${validGuid}`),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization-Token': 'member-only-key' }),
        redirect: 'manual',
      }),
    )
  })

  it('rejects malformed identifiers before contacting Rock', async () => {
    global.fetch = vi.fn()
    await expect(fetchMemberRockFile('../../secret')).resolves.toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['redirects', new Response(null, { status: 302 })],
    ['HTML', new Response('<html/>', { headers: { 'content-type': 'text/html' } })],
    ['oversized declarations', new Response(new Uint8Array([1]), {
      headers: { 'content-type': 'application/pdf', 'content-length': String(26 * 1024 * 1024) },
    })],
  ])('fails closed for %s', async (_label, response) => {
    global.fetch = vi.fn(async () => response)
    await expect(fetchMemberRockFile(validGuid)).resolves.toBeNull()
  })

  it('surfaces transient Rock failures separately from missing files', async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 503 }))

    await expect(fetchMemberRockFile(validGuid)).rejects.toMatchObject({
      name: 'MemberRockFileUnavailableError',
      upstreamStatus: 503,
    })
  })

  it('surfaces network failures separately from missing files', async () => {
    global.fetch = vi.fn(async () => { throw new TypeError('network down') })

    await expect(fetchMemberRockFile(validGuid)).rejects.toMatchObject({
      name: 'MemberRockFileUnavailableError',
    })
  })
})
