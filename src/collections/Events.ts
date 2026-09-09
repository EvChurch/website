import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access/roles'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startDate', 'campus', 'registrationStatus'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'title',
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
      name: 'rockEventId',
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
      name: 'summary',
      type: 'richText',
      admin: {
        readOnly: true,
        description: 'Synced from Rock. Use Website summary below for website-owned content.',
      },
    },
    {
      name: 'websiteSummary',
      label: 'Website summary',
      type: 'richText',
      admin: {
        description: 'Optional website-owned content. When set, this replaces the Rock summary and survives future syncs.',
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Event artwork should use a 16:9 aspect ratio.',
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Feature this event at the top of the events page.',
      },
    },
    {
      name: 'startDate',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Synced from the next Rock occurrence.',
      },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Synced from Rock when an occurrence end time is available.',
      },
    },
    {
      name: 'campus',
      type: 'relationship',
      relationTo: 'campuses',
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
      type: 'group',
      name: 'contactPerson',
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
          name: 'phone',
          type: 'text',
        },
        {
          name: 'photo',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'registrationUrl',
      type: 'text',
    },
    {
      name: 'registrationStatus',
      type: 'select',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Full', value: 'full' },
        { label: 'Closed', value: 'closed' },
        { label: 'Coming Soon', value: 'coming-soon' },
      ],
    },
    {
      name: 'registrationCapacity',
      type: 'number',
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
