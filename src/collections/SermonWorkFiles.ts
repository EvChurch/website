import type { CollectionConfig } from 'payload'
import { isAdmin, isSermonManager } from '@/access/roles'

/** Private originals, listening copies, and renders. Public audio is a separate copy. */
export const SermonWorkFiles: CollectionConfig = {
  slug: 'sermon-work-files',
  admin: { group: 'Sermons', hidden: true },
  upload: { mimeTypes: ['audio/*', 'video/mp4', 'video/quicktime'] },
  access: {
    read: isSermonManager,
    create: isAdmin,
    update: () => false,
    delete: isAdmin,
  },
  fields: [],
}
