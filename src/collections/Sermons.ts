import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access/roles'

export const Sermons: CollectionConfig = {
  slug: 'sermons',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt', 'isPublished'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
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
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'audio',
      type: 'upload',
      relationTo: 'sermon-audio',
    },
    {
      name: 'publishedAt',
      type: 'date',
    },
    {
      name: 'duration',
      type: 'number',
      admin: {
        description: 'Duration in seconds, extracted from audio file metadata',
      },
    },
    {
      name: 'series',
      type: 'relationship',
      relationTo: 'sermon-series',
      hasMany: true,
    },
    {
      name: 'speakers',
      type: 'relationship',
      relationTo: 'speakers',
      hasMany: true,
    },
    {
      name: 'topics',
      type: 'relationship',
      relationTo: 'topics',
      hasMany: true,
    },
    {
      name: 'scriptures',
      type: 'relationship',
      relationTo: 'scriptures',
      hasMany: true,
    },
    {
      name: 'passageReference',
      type: 'text',
      admin: {
        description: 'e.g. "John 7" or "Romans 8-9"',
      },
    },
    {
      name: 'searchText',
      type: 'textarea',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Denormalized text for fast search (auto-populated by sync)',
      },
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: true,
    },
    // Future AI-generated content fields
    {
      name: 'transcript',
      type: 'textarea',
      admin: {
        description: 'AI-generated transcript (future)',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: {
        description: 'AI-generated summary (future)',
      },
    },
    {
      name: 'discussionQuestions',
      type: 'richText',
      admin: {
        description: 'AI-generated discussion questions (future)',
      },
    },
    {
      name: 'enrichedScripture',
      type: 'richText',
      admin: {
        description: 'AI-enriched scripture passages (future)',
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
