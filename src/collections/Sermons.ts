import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access/roles'

export const Sermons: CollectionConfig = {
  slug: 'sermons',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt', 'pipelineStatus', 'isPublished'],
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
    // YouTube video references (per campus)
    {
      name: 'videos',
      type: 'array',
      label: 'YouTube Videos',
      admin: {
        description: 'YouTube video references per campus',
      },
      fields: [
        {
          name: 'campus',
          type: 'relationship',
          relationTo: 'campuses',
          required: true,
        },
        {
          name: 'youtubeVideoId',
          type: 'text',
          required: true,
        },
        {
          name: 'youtubeUrl',
          type: 'text',
          required: true,
        },
        {
          name: 'thumbnailUrl',
          type: 'text',
        },
      ],
    },
    // Sermon segment timestamps (seconds from video start)
    {
      name: 'sermonStartSeconds',
      type: 'number',
      admin: {
        description: 'Sermon start time in seconds from video start',
      },
    },
    {
      name: 'sermonEndSeconds',
      type: 'number',
      admin: {
        description: 'Sermon end time in seconds from video start',
      },
    },
    {
      name: 'boundariesAutoDetected',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'Whether boundaries were auto-detected from transcript',
      },
    },
    {
      name: 'boundariesConfirmed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Team has confirmed or adjusted timestamps',
      },
    },
    // Pipeline tracking
    {
      name: 'pipelineStatus',
      type: 'select',
      defaultValue: 'none',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'None', value: 'none' },
        { label: 'Video Matched', value: 'video-matched' },
        { label: 'Transcribed', value: 'transcribed' },
        { label: 'Boundaries Set', value: 'boundaries-set' },
        { label: 'Blog Generated', value: 'blog-generated' },
        { label: 'Complete', value: 'complete' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'pipelineError',
      type: 'textarea',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Last pipeline error message',
      },
    },
    {
      name: 'blogPost',
      type: 'relationship',
      relationTo: 'blog-posts',
      admin: {
        description: 'AI-generated blog post for this sermon',
      },
    },
    // AI token tracking
    {
      name: 'aiInputTokens',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Anthropic API input tokens used',
      },
    },
    {
      name: 'aiOutputTokens',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Anthropic API output tokens used',
      },
    },
    // AI-generated content fields
    {
      name: 'transcript',
      type: 'textarea',
      admin: {
        description: 'Transcript from YouTube auto-generated captions',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: {
        description: 'AI-generated summary',
      },
    },
    {
      name: 'discussionQuestions',
      type: 'richText',
      admin: {
        description: 'AI-generated discussion questions',
      },
    },
    {
      name: 'enrichedScripture',
      type: 'richText',
      admin: {
        description: 'AI-enriched scripture passages with CSB text',
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
