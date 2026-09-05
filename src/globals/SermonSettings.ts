import type { GlobalConfig } from 'payload'
import { isAdmin, isSermonManager } from '@/access/roles'

export const SermonSettings: GlobalConfig = {
  slug: 'sermon-settings',
  label: 'Sermon Settings',
  admin: { group: 'Sermons' },
  access: { read: isSermonManager, update: isAdmin },
  fields: [
    {
      name: 'intro',
      type: 'upload',
      relationTo: 'sermon-work-files',
      admin: {
        description:
          'Shared intro for future renders. Existing published audio is unchanged.',
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
