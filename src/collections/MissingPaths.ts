import type { CollectionConfig } from 'payload'

import { isEditor } from '@/access/roles'
import { validateMissingPathRedirect } from '@/hooks/validateMissingPathRedirect'

/** Aggregate-only register for eligible missing public paths. */
export const MissingPaths: CollectionConfig = {
  slug: 'missing-paths',
  admin: {
    useAsTitle: 'path',
    defaultColumns: ['path', 'count', 'destination', 'updatedAt'],
    group: 'Website',
  },
  access: {
    read: isEditor,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  hooks: {
    beforeChange: [validateMissingPathRedirect],
  },
  fields: [
    {
      name: 'path',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Normalized public path without query string or trailing slash.' },
    },
    {
      name: 'count',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { readOnly: true },
    },
    {
      name: 'destination',
      type: 'text',
      admin: { description: 'Optional root-relative path applied immediately.' },
    },
  ],
}
