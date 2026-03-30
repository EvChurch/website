import type { CollectionConfig } from 'payload'

import { generateBlurPlaceholder } from '@/hooks/generateBlurPlaceholder'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 400, position: 'centre' },
      { name: 'medium', width: 900, height: undefined },
      { name: 'large', width: 1200, height: undefined },
      { name: 'hero', width: 1920, height: 1080, position: 'centre' },
      {
        name: 'thumbnailWebp',
        width: 400,
        height: 400,
        formatOptions: { format: 'webp' },
      },
      {
        name: 'mediumWebp',
        width: 900,
        height: undefined,
        formatOptions: { format: 'webp' },
      },
      {
        name: 'largeWebp',
        width: 1200,
        height: undefined,
        formatOptions: { format: 'webp' },
      },
    ],
    adminThumbnail: 'thumbnail',
    focalPoint: true,
  },
  hooks: {
    afterChange: [generateBlurPlaceholder],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'text',
    },
    {
      name: 'blurDataURL',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Auto-generated blur placeholder for progressive image loading',
      },
    },
    {
      name: 'rockImageGuid',
      type: 'text',
      index: true,
      admin: {
        description: 'Rock RMS image GUID for sync tracking',
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
}
