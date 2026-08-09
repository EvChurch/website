import type { CollectionConfig, Field } from 'payload'

import { denyExternalMutation, isAdmin } from '@/access/roles'

function resourceFileFields(): Field[] {
  return [
    { name: 'guid', type: 'text' },
    { name: 'name', type: 'text' },
  ]
}

/** A private, read-only mirror of Rock Content Channel 24. */
export const ConnectGroupLeaderResources: CollectionConfig = {
  slug: 'connect-group-leader-resources',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'startDateTime', 'expireDateTime', 'priority'],
  },
  access: {
    read: isAdmin,
    create: denyExternalMutation,
    update: denyExternalMutation,
    delete: denyExternalMutation,
  },
  fields: [
    {
      name: 'rockId',
      type: 'number',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'rockGuid', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'title', type: 'text', required: true },
    { name: 'status', type: 'number', required: true, index: true },
    { name: 'startDateTime', type: 'date', index: true },
    { name: 'expireDateTime', type: 'date', index: true },
    {
      name: 'campusGuids',
      type: 'array',
      admin: { readOnly: true },
      fields: [{ name: 'guid', type: 'text', required: true }],
    },
    {
      name: 'campuses',
      type: 'relationship',
      relationTo: 'campuses',
      hasMany: true,
      index: true,
    },
    { name: 'youtubeUrl', type: 'text' },
    { name: 'promotionalImageGuid', type: 'text' },
    { name: 'description', type: 'textarea' },
    {
      name: 'hosts',
      type: 'array',
      admin: { readOnly: true },
      fields: [
        { name: 'personAliasGuid', type: 'text' },
        { name: 'name', type: 'text', required: true },
        { name: 'photoId', type: 'number' },
      ],
    },
    { name: 'bibleReference', type: 'text' },
    { name: 'leaderNotesFile', type: 'group', fields: resourceFileFields() },
    { name: 'memberStudyFile', type: 'group', fields: resourceFileFields() },
    { name: 'priority', type: 'number', required: true, defaultValue: 0, index: true },
    { name: 'sourceOrder', type: 'number', required: true, defaultValue: 0, index: true },
    {
      name: 'lastSyncedAt',
      type: 'date',
      required: true,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
