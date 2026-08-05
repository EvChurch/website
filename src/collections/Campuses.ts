import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access/roles'
import { UpcomingEventsBlock } from '@/blocks/UpcomingEventsBlock'

export const Campuses: CollectionConfig = {
  slug: 'campuses',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'isActive', 'order'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
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
      name: 'rockId',
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
      type: 'group',
      name: 'address',
      fields: [
        {
          name: 'street',
          type: 'text',
        },
        {
          name: 'city',
          type: 'text',
        },
        {
          name: 'postalCode',
          type: 'text',
        },
      ],
    },
    {
      type: 'group',
      name: 'geoPoint',
      fields: [
        {
          name: 'lat',
          type: 'number',
        },
        {
          name: 'lng',
          type: 'number',
        },
      ],
    },
    {
      name: 'googlePlaceId',
      type: 'text',
    },
    {
      name: 'serviceTimes',
      type: 'text',
      admin: {
        description: 'e.g. "Sunday at 10:15am"',
      },
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'slideImages',
      type: 'array',
      maxRows: 4,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    {
      name: 'establishmentYear',
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
    {
      name: 'pageContent',
      type: 'group',
      admin: {
        description: 'Content displayed on this campus landing page.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Publish this campus at /campus/{slug}.',
          },
        },
        {
          name: 'brandName',
          type: 'text',
        },
        {
          name: 'tagline',
          type: 'text',
        },
        {
          name: 'locationLabel',
          type: 'text',
        },
        {
          name: 'seoTitle',
          type: 'text',
          admin: {
            description: 'Optional browser and search title. A campus title is generated when empty.',
          },
        },
        {
          name: 'seoDescription',
          type: 'textarea',
          admin: {
            description: 'Optional search description. Campus details are used when empty.',
          },
        },
        {
          name: 'serviceDay',
          type: 'text',
          defaultValue: 'Sunday',
        },
        {
          name: 'serviceTimeLabel',
          type: 'text',
        },
        {
          name: 'serviceOpens',
          type: 'text',
        },
        {
          name: 'serviceCloses',
          type: 'text',
        },
        {
          name: 'serviceDuration',
          type: 'text',
          defaultValue: 'Approximately 75 minutes',
        },
        {
          name: 'kidsProgram',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'kidsAges',
          type: 'text',
        },
        {
          name: 'heroImagePath',
          type: 'text',
          admin: {
            description: 'Fallback public image path used when Featured Image is empty.',
          },
        },
        {
          name: 'galleryImages',
          type: 'array',
          maxRows: 4,
          admin: {
            description: 'Fallback images used when Slide Images are empty.',
          },
          fields: [
            {
              name: 'src',
              type: 'text',
            },
            {
              name: 'alt',
              type: 'text',
            },
          ],
        },
        {
          name: 'mapUrl',
          type: 'text',
        },
        {
          name: 'parkingInfo',
          type: 'textarea',
        },
        {
          name: 'ctaHeading',
          type: 'text',
          defaultValue: 'See you this Sunday',
        },
        {
          name: 'ctaText',
          type: 'textarea',
        },
        {
          name: 'ctaLabel',
          type: 'text',
          defaultValue: 'Plan your visit',
        },
        {
          name: 'ctaHref',
          type: 'text',
          defaultValue: '/visit',
        },
      ],
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [UpcomingEventsBlock],
      admin: {
        description: 'Managed sections displayed before the closing campus call to action.',
      },
    },
  ],
}
