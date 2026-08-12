import type { CollectionConfig } from 'payload'

import { isContentLead } from '@/access/roles'

export const SiteFeedback: CollectionConfig = {
  slug: 'feedback-submissions',
  admin: {
    useAsTitle: 'comment',
    defaultColumns: ['comment', 'email', 'sourceUrl', 'createdAt'],
  },
  access: {
    create: isContentLead,
    read: isContentLead,
    update: isContentLead,
    delete: isContentLead,
  },
  fields: [
    {
      name: 'comment',
      label: 'Comment',
      type: 'textarea',
      required: true,
      maxLength: 4_000,
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
    },
    {
      name: 'sourceUrl',
      label: 'Page URL',
      type: 'text',
      required: true,
      maxLength: 2_048,
    },
    {
      name: 'clientAddressDigest',
      label: 'Client address digest',
      type: 'text',
      required: true,
      maxLength: 128,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'userAgent',
      label: 'User agent',
      type: 'text',
      maxLength: 512,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
}
