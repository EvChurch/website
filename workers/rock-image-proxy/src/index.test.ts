import { afterEach, describe, expect, it, vi } from 'vitest'

import worker from './index'

describe('rock image proxy worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards GetImage requests to Rock with their path and query string', async () => {
    const upstreamResponse = new Response('image', {
      headers: {
        'content-type': 'image/jpeg',
        'set-cookie': 'RockSession=secret',
      },
      status: 200,
    })
    const fetchMock = vi.fn().mockResolvedValue(upstreamResponse)
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://www.ev.church/GetImage.ashx?Guid=photo-guid&w=1200', {
        headers: {
          accept: 'image/avif,image/webp,*/*',
          authorization: 'Bearer website-token',
          cookie: 'member-session=secret',
          'if-none-match': 'image-etag',
        },
      }),
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const upstreamRequest = fetchMock.mock.calls[0]?.[0] as Request
    expect(upstreamRequest.url).toBe(
      'https://rock.ev.church/GetImage.ashx?Guid=photo-guid&w=1200',
    )
    expect(upstreamRequest.headers.get('accept')).toBe('image/avif,image/webp,*/*')
    expect(upstreamRequest.headers.get('if-none-match')).toBe('image-etag')
    expect(upstreamRequest.headers.has('authorization')).toBe(false)
    expect(upstreamRequest.headers.has('cookie')).toBe(false)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.has('set-cookie')).toBe(false)
  })

  it('forwards GetAvatar requests to Rock with their path and query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('avatar', {
        headers: { 'content-type': 'image/jpeg' },
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://www.ev.church/GetAvatar.ashx?PhotoId=3822'),
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const upstreamRequest = fetchMock.mock.calls[0]?.[0] as Request
    expect(upstreamRequest.url).toBe(
      'https://rock.ev.church/GetAvatar.ashx?PhotoId=3822',
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
  })

  it('rejects requests outside the supported image paths', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(new Request('https://www.ev.church/api/users'))

    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows only GET and HEAD requests', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://www.ev.church/GetImage.ashx?Guid=photo-guid', {
        method: 'POST',
      }),
    )

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards HEAD requests and preserves response metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: { etag: 'image-etag' },
        status: 204,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://www.ev.church/GetImage.ashx?Guid=photo-guid', {
        method: 'HEAD',
      }),
    )

    const upstreamRequest = fetchMock.mock.calls[0]?.[0] as Request
    expect(upstreamRequest.method).toBe('HEAD')
    expect(response.status).toBe(204)
    expect(response.headers.get('etag')).toBe('image-etag')
  })

  it.each([
    [new DOMException('Timed out', 'TimeoutError'), 504, 'Gateway timeout'],
    [new TypeError('Network failure'), 502, 'Bad gateway'],
  ])('returns a controlled response when Rock fails', async (error, status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))

    const response = await worker.fetch(
      new Request('https://www.ev.church/GetImage.ashx?Guid=photo-guid'),
    )

    expect(response.status).toBe(status)
    await expect(response.text()).resolves.toBe(body)
  })
})
