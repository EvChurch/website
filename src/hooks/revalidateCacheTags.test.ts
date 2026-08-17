import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidateTag = vi.hoisted(() => vi.fn())

vi.mock('next/cache', () => ({ revalidateTag }))

import { CACHE_TAGS } from '@/lib/cache-tags'
import { Announcements } from '@/collections/Announcements'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { SiteSettings } from '@/globals/SiteSettings'
import { createCacheInvalidationHook } from './revalidateCacheTags'

describe('createCacheInvalidationHook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('immediately expires each configured cache tag', () => {
    const invalidate = createCacheInvalidationHook(
      CACHE_TAGS.pages,
      CACHE_TAGS.siteSettings,
    )

    invalidate()

    expect(revalidateTag).toHaveBeenCalledTimes(2)
    expect(revalidateTag).toHaveBeenNthCalledWith(1, CACHE_TAGS.pages, { expire: 0 })
    expect(revalidateTag).toHaveBeenNthCalledWith(2, CACHE_TAGS.siteSettings, { expire: 0 })
  })

  it('is wired to editorial collection and global writes', async () => {
    const pageChange = Pages.hooks?.afterChange?.[0]
    const pageDelete = Pages.hooks?.afterDelete?.[0]
    const mediaChange = Media.hooks?.afterChange?.[1]
    const announcementChange = Announcements.hooks?.afterChange?.[0]
    const announcementDelete = Announcements.hooks?.afterDelete?.[0]
    const siteSettingsChange = SiteSettings.hooks?.afterChange?.[0]

    if (
      typeof pageChange !== 'function' ||
      typeof pageDelete !== 'function' ||
      typeof mediaChange !== 'function' ||
      typeof announcementChange !== 'function' ||
      typeof announcementDelete !== 'function' ||
      typeof siteSettingsChange !== 'function'
    ) {
      throw new Error('Editorial cache invalidation hooks are not configured')
    }

    await pageChange({} as never)
    await pageDelete({} as never)
    await mediaChange({} as never)
    await announcementChange({} as never)
    await announcementDelete({} as never)
    await siteSettingsChange({} as never)

    expect(revalidateTag.mock.calls).toEqual([
      [CACHE_TAGS.pages, { expire: 0 }],
      [CACHE_TAGS.pages, { expire: 0 }],
      [CACHE_TAGS.pages, { expire: 0 }],
      [CACHE_TAGS.announcements, { expire: 0 }],
      [CACHE_TAGS.announcements, { expire: 0 }],
      [CACHE_TAGS.siteSettings, { expire: 0 }],
    ])
  })
})
