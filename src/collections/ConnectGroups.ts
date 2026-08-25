import type { CollectionConfig } from 'payload'

import { denyExternalMutation } from '@/access/roles'

export const ConnectGroups: CollectionConfig = {
  slug: 'connect-groups',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'campus', 'isActive', 'capacity'],
  },
  access: {
    read: () => true,
    create: denyExternalMutation,
    update: denyExternalMutation,
    delete: denyExternalMutation,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'rockGroupId',
      type: 'number',
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'rockGroupGuid',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'publicName',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'Public location or group name supplied by Rock.',
      },
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'leaders',
      type: 'array',
      fields: [
        {
          name: 'name',
          type: 'text',
        },
        {
          name: 'email',
          type: 'email',
        },
        {
          name: 'photoId',
          type: 'number',
          admin: {
            readOnly: true,
          },
        },
      ],
    },
    {
      type: 'group',
      name: 'location',
      fields: [
        {
          name: 'name',
          type: 'text',
        },
        {
          name: 'address',
          type: 'text',
        },
      ],
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'capacity',
      type: 'number',
    },
    {
      name: 'meetingDay',
      type: 'number',
      min: 0,
      max: 6,
      admin: {
        readOnly: true,
        description: 'Rock day of week, where Sunday is 0.',
      },
    },
    {
      name: 'meetingTime',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'scheduleText',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'campus',
      type: 'relationship',
      relationTo: 'campuses',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'lastSyncedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
}
