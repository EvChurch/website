import type { CollectionConfig } from 'payload'
import { isEditor, publishedOnly } from '@/access/roles'
import { createCacheInvalidationHook } from '@/hooks/revalidateCacheTags'
import { CACHE_TAGS } from '@/lib/cache-tags'

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startDate', 'endDate', '_status'],
  },
  versions: {
    drafts: true,
  },
  access: {
    read: publishedOnly,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  hooks: {
    afterChange: [createCacheInvalidationHook(CACHE_TAGS.announcements)],
    afterDelete: [createCacheInvalidationHook(CACHE_TAGS.announcements)],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'message',
      type: 'richText',
      required: true,
    },
    {
      name: 'link',
      type: 'group',
      fields: [
        {
          name: 'label',
          type: 'text',
        },
        {
          name: 'href',
          type: 'text',
        },
      ],
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
      admin: {
        description: 'When this announcement becomes visible',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
      admin: {
        description: 'When this announcement stops showing',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'colorPreset',
      type: 'select',
      options: [
        { label: 'Primary Red', value: 'primary-red' },
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
      ],
      defaultValue: 'primary-red',
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
