import { revalidateTag } from 'next/cache'

import type { CacheTag } from '@/lib/cache-tags'

export function createCacheInvalidationHook(...tags: CacheTag[]) {
  return () => {
    for (const tag of tags) {
      revalidateTag(tag, { expire: 0 })
    }
  }
}
