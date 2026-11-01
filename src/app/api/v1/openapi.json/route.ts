import { openApi } from '@/lib/api/openapi'

export function GET() {
  return Response.json(openApi, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  })
}
