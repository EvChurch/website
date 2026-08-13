import { trackNotFound } from '@/lib/tracked-not-found'

export const privateMemberMediaHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}

export function memberMediaNotFound(...pathSegments: string[]) {
  trackNotFound(...pathSegments)
  return new Response(null, { status: 404, headers: privateMemberMediaHeaders })
}

export function memberMediaUnavailable() {
  return new Response(null, { status: 503, headers: privateMemberMediaHeaders })
}

export function memberMediaResponse(
  body: Uint8Array<ArrayBuffer>,
  contentType: string,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(body, {
    headers: {
      ...privateMemberMediaHeaders,
      'Content-Type': contentType,
      ...extraHeaders,
    },
  })
}
