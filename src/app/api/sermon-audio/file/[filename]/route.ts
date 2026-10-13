interface Context {
  params: Promise<{ filename: string }>
}

export async function GET(request: Request, { params }: Context) {
  const { filename } = await params
  const url = new URL(request.url)
  // Cloudflare can convert HEAD to GET for cacheable file extensions, even when
  // our response is no-store. Redirect through the non-cacheable stream path so
  // it receives the client's real method before creating a method-bound signature.
  url.pathname = '/api/sermon-audio/stream'
  url.searchParams.set('file', filename)
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.pathname}${url.search}`,
      'Cache-Control': 'private, no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
    },
  })
}

export const HEAD = GET
