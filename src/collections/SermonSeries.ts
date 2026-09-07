import { reindexSermonTaxonomy } from '@/hooks/reindexSermonTaxonomy'
import { authorSermonMetadata } from '@/hooks/authorSermonMetadata'
import { createCacheInvalidationHook } from '@/hooks/revalidateCacheTags'
import type { CollectionConfig } from 'payload'

import { isSermonManager, isAdmin } from '@/access/roles'

export const SermonSeries: CollectionConfig = {
  slug: 'sermon-series',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'isPublished'],
  },
  access: {
    read: () => true,
    create: isSermonManager,
    update: isSermonManager,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [authorSermonMetadata],
    afterChange: [reindexSermonTaxonomy, createCacheInvalidationHook('sermons', 'sermon-series')],
    afterDelete: [createCacheInvalidationHook('sermon-series')],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'resourceId',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bannerImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'foregroundImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'lastSyncedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
}
