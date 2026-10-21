import { revalidateTag } from 'next/cache'
import { after } from 'next/server'

import type { CacheTag } from '@/lib/cache-tags'

export function createCacheInvalidationHook(...tags: CacheTag[]) {
  return (args?: {
    context?: Record<string, unknown>
    req?: { payloadAPI?: string }
  }) => {
    if (args?.context?.skipCacheInvalidation === true) return

    const invalidate = () => {
      for (const tag of tags) {
        revalidateTag(tag, { expire: 0 })
      }
    }

    // MCP tools can finish after Next has returned the streaming response and
    // flushed request revalidations. after() flushes these late writes as well.
    if (args?.req?.payloadAPI === 'MCP') after(invalidate)
    else invalidate()
  }
}
