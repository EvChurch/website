import type { Block } from 'payload'

export const ManualCardGridBlock: Block = {
  slug: 'manualCardGrid',
  interfaceName: 'ManualCardGridBlock',
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
    },
    {
      name: 'heading',
      type: 'text',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'cardStyle',
      type: 'select',
      defaultValue: 'info',
      options: [
        { label: 'Info card', value: 'info' },
        { label: 'Image overlay', value: 'imageOverlay' },
        { label: 'Image on top', value: 'imageTop' },
        { label: 'Profile', value: 'profile' },
        { label: 'Alternating rows', value: 'alternatingRows' },
      ],
    },
    {
      name: 'columns',
      type: 'select',
      defaultValue: '3',
      options: [
        { label: '2 columns', value: '2' },
        { label: '3 columns', value: '3' },
        { label: '4 columns', value: '4' },
      ],
    },
    {
      name: 'cards',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'subtitle',
          type: 'text',
          admin: { description: 'Time, location, or other detail' },
        },
        {
          name: 'description',
          type: 'textarea',
        },
        {
          name: 'eyebrow',
          type: 'text',
          admin: { description: 'Small label above title (e.g. location)' },
        },
        {
          name: 'address',
          type: 'text',
          admin: { description: 'Street address shown below time' },
        },
        {
          name: 'mapUrl',
          type: 'text',
          admin: { description: 'Google Maps URL used for the embedded map' },
        },
        {
          name: 'href',
          type: 'text',
          admin: { description: 'Destination for the card action' },
        },
        {
          name: 'linkLabel',
          type: 'text',
          admin: { description: 'Link text (e.g. "Learn more about North Campus")' },
        },
        {
          name: 'details',
          type: 'array',
          admin: { description: 'Key-value pairs (e.g. schedule rows)' },
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
            },
            {
              name: 'value',
              type: 'text',
              required: true,
            },
          ],
        },
      ],
    },
  ],
}
