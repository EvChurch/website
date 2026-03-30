import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access/roles'

export const SermonAudio: CollectionConfig = {
  slug: 'sermon-audio',
  upload: {
    mimeTypes: ['audio/x-m4a', 'audio/mp4', 'audio/mpeg', 'audio/aac'],
  },
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'mimeType', 'filesize'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'duration',
      type: 'number',
      admin: {
        description: 'Duration in seconds',
        readOnly: true,
      },
    },
  ],
}
