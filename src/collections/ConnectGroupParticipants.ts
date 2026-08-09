import type { CollectionConfig } from 'payload'

import { denyExternalMutation, isAdmin } from '@/access/roles'

/** A private, read-only mirror of people with active Connect Group memberships. */
export const ConnectGroupParticipants: CollectionConfig = {
  slug: 'connect-group-participants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'isCoach', 'lastSyncedAt'],
  },
  access: {
    read: isAdmin,
    create: denyExternalMutation,
    update: denyExternalMutation,
    delete: denyExternalMutation,
  },
  fields: [
    {
      name: 'rockPersonId',
      type: 'number',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'name', type: 'text', required: true, index: true },
    { name: 'email', type: 'email', index: true },
    {
      name: 'phoneNumbers',
      type: 'array',
      admin: { readOnly: true },
      fields: [
        { name: 'number', type: 'text', required: true },
        { name: 'typeValueId', type: 'number' },
        { name: 'isMessagingEnabled', type: 'checkbox', required: true, defaultValue: false },
      ],
    },
    { name: 'photoId', type: 'number', index: true },
    { name: 'isCoach', type: 'checkbox', required: true, defaultValue: false, index: true },
    {
      name: 'memberships',
      type: 'array',
      admin: { readOnly: true },
      fields: [
        { name: 'rockGroupId', type: 'number', required: true, index: true },
        { name: 'rockMembershipId', type: 'number', required: true, unique: true },
        { name: 'rockRoleId', type: 'number', required: true },
        { name: 'roleName', type: 'text', required: true },
        { name: 'isLeader', type: 'checkbox', required: true, defaultValue: false },
      ],
    },
    {
      name: 'lastSyncedAt',
      type: 'date',
      required: true,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
