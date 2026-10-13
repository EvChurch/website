import type { GlobalConfig } from 'payload'
import { isAdmin, isSermonManager } from '@/access/roles'

export const SermonSettings: GlobalConfig = {
  slug: 'sermon-settings',
  label: 'Sermon Settings',
  admin: { group: 'Sermons' },
  access: { read: isSermonManager, update: isAdmin },
  fields: [
    {
      name: 'calendar', type: 'group', label: 'Teaching calendar',
      fields: [
        { name: 'spreadsheetId', type: 'text', label: 'Spreadsheet ID or URL' },
        { name: 'worksheet', type: 'text', admin: { description: 'Exact worksheet name, for example Teaching Calendar 2026.' } },
        { name: 'dateColumn', type: 'text', defaultValue: 'B' },
        { name: 'titleHeader', type: 'text', defaultValue: 'Sunday Topic' },
        { name: 'seriesHeader', type: 'text', defaultValue: 'Series' },
        { name: 'passageHeader', type: 'text', defaultValue: 'Bible Reading' },
        { name: 'campuses', type: 'array', fields: [
          { name: 'campus', type: 'relationship', relationTo: 'campuses', required: true },
          { name: 'preacherHeader', type: 'text', required: true },
        ] },
        { name: 'speakers', type: 'array', fields: [
          { name: 'label', type: 'text', required: true },
          { name: 'speaker', type: 'relationship', relationTo: 'speakers', required: true },
        ] },
      ],
    },
    {
      name: 'intro',
      type: 'upload',
      relationTo: 'sermon-work-files',
      admin: {
        description:
          'Optional shared intro for future renders. Leave empty for outro-only audio. Existing published audio is unchanged.',
      },
    },
    { name: 'outro', type: 'upload', relationTo: 'sermon-work-files' },
    {
      name: 'driveFolders',
      type: 'array',
      fields: [
        {
          name: 'campus',
          type: 'relationship',
          relationTo: 'campuses',
          required: true,
        },
        {
          name: 'folderId',
          type: 'text',
          required: true,
          validate: (value: unknown) =>
            typeof value === 'string' && /^[\w-]+$/.test(value)
              ? true
              : 'Enter the folder ID from its Google Drive URL.',
        },
      ],
    },
  ],
}
