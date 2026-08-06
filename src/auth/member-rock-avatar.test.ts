import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const readMemberRockConfig = vi.hoisted(() => vi.fn())

vi.mock('./member-rock-config', () => ({ readMemberRockConfig }))

import { fetchMemberRockAvatar } from './member-rock-avatar'

const originalFetch = global.fetch

function bytes(size: number) {
  return new Uint8Array(size).fill(1)
}

describe('member Rock avatar client', () => {
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

  it('fetches a documented Rock image path with the member-only credential', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(bytes(3), {
        headers: { 'content-type': 'image/jpeg', 'content-length': '3' },
      }),
    )
    global.fetch = fetchMock

    await expect(fetchMemberRockAvatar('/GetImage.ashx?id=42')).resolves.toEqual({
      body: bytes(3),
      contentType: 'image/jpeg',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://rock.example.test/GetImage.ashx?id=42'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization-Token': 'member-only-key',
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
        }),
        redirect: 'manual',
      }),
    )
  })

  it.each([
    ['arbitrary host', 'https://attacker.example/GetImage.ashx?id=42'],
    ['arbitrary path', '/api/People/42'],
    ['path smuggling', '/GetImage.ashx/../People?id=42'],
    ['unsupported query', '/GetImage.ashx?url=https://attacker.example'],
    ['missing image identity', '/GetImage.ashx?w=200'],
  ])('rejects an %s before contacting Rock', async (_label, photoReference) => {
    const fetchMock = vi.fn()
    global.fetch = fetchMock

    await expect(fetchMemberRockAvatar(photoReference)).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['redirect', new Response(null, { status: 302, headers: { location: 'https://attacker.example/image' } })],
    ['SVG', new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })],
    ['non-image', new Response('nope', { headers: { 'content-type': 'text/plain' } })],
    ['upstream denial', new Response(null, { status: 403 })],
  ])('fails closed for an upstream %s', async (_label, upstreamResponse) => {
    global.fetch = vi.fn(async () => upstreamResponse)

    await expect(fetchMemberRockAvatar('/GetImage.ashx?id=42')).resolves.toBeNull()
  })

  it('rejects an oversized response while reading the stream', async () => {
    global.fetch = vi.fn(async () =>
      new Response(bytes(5 * 1024 * 1024 + 1), {
        headers: { 'content-type': 'image/png' },
      }),
    )

    await expect(fetchMemberRockAvatar('/GetImage.ashx?id=42')).resolves.toBeNull()
  })

  it('fails safely when the request times out', async () => {
    global.fetch = vi.fn(async () => {
      throw new DOMException('Timed out', 'TimeoutError')
    })

    await expect(fetchMemberRockAvatar('/GetImage.ashx?id=42')).resolves.toBeNull()
  })
})
