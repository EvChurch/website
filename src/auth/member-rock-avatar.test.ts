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
    [
      'numeric photo id',
      '/GetAvatar.ashx?PhotoId=42&AgeClassification=Adult&Gender=Male&RecordTypeId=1&Text=AM',
    ],
    [
      'hashed photo id',
      '/GetAvatar.ashx?fileIdKey=AbC123_xYz&AgeClassification=Adult&Gender=Male&RecordTypeId=1&Text=AM&Style=Icon&Size=128',
    ],
  ])('fetches a Rock avatar using a %s', async (_label, photoReference) => {
    const fetchMock = vi.fn(async () =>
      new Response(bytes(3), {
        headers: { 'content-type': 'image/jpeg', 'content-length': '3' },
      }),
    )
    global.fetch = fetchMock

    await expect(fetchMemberRockAvatar(photoReference)).resolves.toEqual({
      body: bytes(3),
      contentType: 'image/jpeg',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      new URL(`https://rock.example.test${photoReference}`),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization-Token': 'member-only-key',
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
    ['avatar without a photo identity', '/GetAvatar.ashx?Text=AM'],
    [
      'avatar with an unsupported query',
      '/GetAvatar.ashx?PhotoId=42&url=https://attacker.example',
    ],
    [
      'avatar with duplicate identity parameters',
      '/GetAvatar.ashx?PhotoId=42&fileIdKey=AbC123',
    ],
    ['avatar with an invalid photo id', '/GetAvatar.ashx?PhotoId=0'],
    ['avatar with an invalid file key', '/GetAvatar.ashx?fileIdKey=bad.key'],
    [
      'avatar with malformed age classification',
      '/GetAvatar.ashx?PhotoId=42&AgeClassification=Adult%20User',
    ],
    [
      'avatar with malformed gender',
      '/GetAvatar.ashx?PhotoId=42&Gender=Not%2FAValue',
    ],
    [
      'avatar with an invalid record type',
      '/GetAvatar.ashx?PhotoId=42&RecordTypeId=0',
    ],
    [
      'avatar with overlong text',
      `/GetAvatar.ashx?PhotoId=42&Text=${'A'.repeat(17)}`,
    ],
    [
      'avatar with control-character text',
      '/GetAvatar.ashx?PhotoId=42&Text=AM%0A',
    ],
    [
      'avatar with unsupported style',
      '/GetAvatar.ashx?PhotoId=42&Style=Square',
    ],
    ['avatar with zero size', '/GetAvatar.ashx?PhotoId=42&Size=0'],
    ['avatar with oversized size', '/GetAvatar.ashx?PhotoId=42&Size=2049'],
    [
      'avatar with case-variant duplicate parameters',
      '/GetAvatar.ashx?PhotoId=42&PHOTOID=43',
    ],
    [
      'avatar with a fragment',
      '/GetAvatar.ashx?PhotoId=42#unexpected',
    ],
    [
      'avatar with embedded credentials',
      'https://user:password@rock.example.test/GetAvatar.ashx?PhotoId=42',
    ],
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
