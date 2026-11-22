import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'

export interface BlockVisibility {
  visibility?: { from?: string | null; until?: string | null } | null
}

export function isBlockVisible(block: BlockVisibility, now = Date.now()): boolean {
  const from = block.visibility?.from
  const until = block.visibility?.until
  return (!from || now >= Date.parse(from)) && (!until || now < Date.parse(until))
}

export function getVisibilityCacheWindow(blocks: BlockVisibility[], normalLifetime: number, now = Date.now()) {
  const boundaries = blocks.flatMap(({ visibility }) => [visibility?.from, visibility?.until])
    .filter((date): date is string => Boolean(date))
    .map(Date.parse).filter(Number.isFinite)
  const next = Math.min(...boundaries.filter((time) => time > now))
  const periodStart = Math.max(Number.MIN_SAFE_INTEGER, ...boundaries.filter((time) => time <= now))
  return {
    periodStart,
    revalidate: Math.min(normalLifetime, Math.max(1, Math.floor((next - now) / 1000))),
  }
}

export async function getVisibleBlocks<T extends BlockVisibility>(blocks: T[]): Promise<T[]> {
  if (!blocks.some((block) => block.visibility?.from || block.visibility?.until)) return blocks
  const { periodStart, revalidate } = getVisibilityCacheWindow(blocks, 86_400)
  // A shorter data-cache lifetime also shortens Next's full-page ISR lifetime.
  // Include the visibility period in the key so regeneration cannot reuse the
  // previous period's visible blocks after a boundary. Keep ordinary CMS caching.
  return unstable_cache(
    async (layout: T[], start: number) => layout.filter((block) => isBlockVisible(block, start)),
    ['scheduled-page-blocks'],
    { revalidate, tags: [CACHE_TAGS.pages, CACHE_TAGS.campuses] },
  )(blocks, periodStart)
}
