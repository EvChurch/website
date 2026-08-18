const ROCK_ORIGIN = 'https://rock.ev.church'
const ROCK_FETCH_TIMEOUT_MS = 10_000

const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'if-modified-since',
  'if-none-match',
  'range',
] as const

const worker = {
  async fetch(request: Request): Promise<Response> {
    const requestUrl = new URL(request.url)

    if (!requestUrl.pathname.startsWith('/GetImage')) {
      return new Response('Not found', { status: 404 })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        headers: { allow: 'GET, HEAD' },
        status: 405,
      })
    }

    const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, ROCK_ORIGIN)
    const upstreamHeaders = new Headers()

    for (const header of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers.get(header)
      if (value) upstreamHeaders.set(header, value)
    }

    let upstreamResponse: Response

    try {
      upstreamResponse = await fetch(
        new Request(upstreamUrl, {
          headers: upstreamHeaders,
          method: request.method,
          redirect: 'follow',
          signal: AbortSignal.timeout(ROCK_FETCH_TIMEOUT_MS),
        }),
      )
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
      return new Response(timedOut ? 'Gateway timeout' : 'Bad gateway', {
        status: timedOut ? 504 : 502,
      })
    }

    const responseHeaders = new Headers(upstreamResponse.headers)
    responseHeaders.delete('set-cookie')

    return new Response(upstreamResponse.body, {
      headers: responseHeaders,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
    })
  },
}

export default worker
