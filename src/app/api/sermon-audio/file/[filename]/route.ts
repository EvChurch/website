import { GET as streamGET, HEAD as streamHEAD } from '../../stream/route'

interface Context {
  params: Promise<{ filename: string }>
}

async function streamRequest(request: Request, { params }: Context) {
  const { filename } = await params
  const url = new URL(request.url)
  // Keep published podcast URLs stable; only the storage destination expires.
  url.searchParams.set('file', filename)
  return new Request(url, { method: request.method, headers: request.headers })
}

export async function GET(request: Request, context: Context) {
  return streamGET(await streamRequest(request, context))
}

export async function HEAD(request: Request, context: Context) {
  return streamHEAD(await streamRequest(request, context))
}
