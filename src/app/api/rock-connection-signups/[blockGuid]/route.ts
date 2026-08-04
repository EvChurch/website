import { NextRequest } from 'next/server'

import { handleGet, handlePost } from './handler'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ blockGuid: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  return handleGet(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handlePost(request, context)
}
