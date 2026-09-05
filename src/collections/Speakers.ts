import { reindexSermonTaxonomy } from '@/hooks/reindexSermonTaxonomy'
import { authorSermonMetadata } from '@/hooks/authorSermonMetadata'
import { createCacheInvalidationHook } from '@/hooks/revalidateCacheTags'
import type { CollectionConfig } from 'payload'

import { isSermonManager, isAdmin } from '@/access/roles'

export const Speakers: CollectionConfig = {
  slug: 'speakers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
  },
  access: {
    read: () => true,
    create: isSermonManager,
    update: isSermonManager,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [authorSermonMetadata],
    afterChange: [reindexSermonTaxonomy, createCacheInvalidationHook('sermons', 'speakers')],
    afterDelete: [createCacheInvalidationHook('speakers')],
  },
  fields: [
    {
      name: 'name',
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
      name: 'lastSyncedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
}
