import type { Access, CollectionConfig } from 'payload'

const deny: Access = () => false

/** Private member-portal discussion records. All access goes through member authorization. */
export const ConnectGroupComments: CollectionConfig = {
  slug: 'connect-group-comments',
  admin: { hidden: true, useAsTitle: 'authorName' },
  access: { read: deny, create: deny, update: deny, delete: deny },
  fields: [
    { name: 'rockGroupId', type: 'number', required: true, index: true },
    { name: 'authorRockPersonId', type: 'number', required: true, index: true },
    { name: 'authorName', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true, maxLength: 4000 },
    { name: 'deletedAt', type: 'date', index: true },
    { name: 'deletedByRockPersonId', type: 'number', index: true },
    { name: 'deletedByName', type: 'text' },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'leaders-and-coaches',
      options: [
        { label: 'Leaders and coaches', value: 'leaders-and-coaches' },
        { label: 'Coaches only', value: 'coaches-only' },
      ],
    },
  ],
}
