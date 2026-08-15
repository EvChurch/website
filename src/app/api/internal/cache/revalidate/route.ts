import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { CACHE_TAGS, type CacheTag } from '@/lib/cache-tags'

const allowedTags = new Set<CacheTag>(Object.values(CACHE_TAGS))

function isCacheTag(value: unknown): value is CacheTag {
  return typeof value === 'string' && allowedTags.has(value as CacheTag)
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tags = typeof body === 'object' && body !== null && 'tags' in body
    ? (body as { tags: unknown }).tags
    : null

  if (!Array.isArray(tags) || tags.length === 0 || !tags.every(isCacheTag)) {
    return NextResponse.json({ error: 'Invalid cache tags' }, { status: 400 })
  }

  const uniqueTags = [...new Set(tags)]
  for (const tag of uniqueTags) {
    revalidateTag(tag, { expire: 0 })
  }

  return NextResponse.json({ ok: true, revalidated: uniqueTags })
}
