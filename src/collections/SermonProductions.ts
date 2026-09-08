import type { CollectionConfig } from 'payload'
import { isAdmin, isSermonManager } from '@/access/roles'

/** Only the authenticated workflow API writes processing state. */
export const SermonProductions: CollectionConfig = {
  slug: 'sermon-productions',
  admin: { group: 'Sermons', useAsTitle: 'sourceName', hidden: true },
  access: {
    read: isSermonManager,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'sermon',
      type: 'relationship',
      relationTo: 'sermons',
      required: true,
      index: true,
    },
    { name: 'baseSermonRevision', type: 'text', required: true },
    { name: 'sourceName', type: 'text', required: true },
    { name: 'driveFileId', type: 'text' },
    { name: 'driveModifiedTime', type: 'text' },
    { name: 'campus', type: 'relationship', relationTo: 'campuses' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'importing',
      options: [
        'importing',
        'editable',
        'rendering',
        'ready',
        'published',
        'failed',
        'discarded',
      ],
    },
    { name: 'jobToken', type: 'text', required: true },
    { name: 'source', type: 'upload', relationTo: 'sermon-work-files' },
    { name: 'listeningCopy', type: 'upload', relationTo: 'sermon-work-files' },
    { name: 'output', type: 'upload', relationTo: 'sermon-work-files' },
    { name: 'intro', type: 'upload', relationTo: 'sermon-work-files' },
    { name: 'outro', type: 'upload', relationTo: 'sermon-work-files' },
    { name: 'sourceDuration', type: 'number' },
    { name: 'outputDuration', type: 'number' },
    { name: 'peaks', type: 'json' },
    { name: 'start', type: 'number', min: 0 },
    { name: 'end', type: 'number', min: 0 },
    { name: 'metadata', type: 'json' },
    { name: 'calendarNotice', type: 'text' },
    { name: 'error', type: 'text' },
    {
      name: 'publishedAudio',
      type: 'relationship',
      relationTo: 'sermon-audio',
    },
  ],
}
