import type { Block } from 'payload'

export const PhotoStripBlock: Block = {
  slug: 'photoStrip',
  interfaceName: 'PhotoStripBlock',
  fields: [
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'horizontalScroll',
      options: [
        { label: 'Horizontal scroll', value: 'horizontalScroll' },
        { label: '4-column grid', value: 'grid4' },
        { label: '2-column staggered', value: 'grid2' },
        { label: 'Masonry', value: 'masonry' },
      ],
    },
    {
      name: 'images',
      type: 'array',
      required: true,
      minRows: 2,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
  ],
}
