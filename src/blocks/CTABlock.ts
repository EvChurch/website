import type { Block } from 'payload'

export const CTABlock: Block = {
  slug: 'cta',
  interfaceName: 'CTABlock',
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
    },
    {
      name: 'text',
      type: 'textarea',
    },
    {
      name: 'buttons',
      type: 'array',
      maxRows: 2,
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'href',
          type: 'text',
          required: true,
        },
        {
          name: 'variant',
          type: 'select',
          options: [
            { label: 'Primary', value: 'primary' },
            { label: 'Secondary', value: 'secondary' },
          ],
        },
      ],
    },
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional background image (darkened overlay applied automatically)' },
    },
    {
      name: 'colorPreset',
      type: 'select',
      defaultValue: 'primary-red',
      options: [
        { label: 'Primary Red', value: 'primary-red' },
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
      ],
    },
    {
      name: 'supportingText',
      type: 'text',
      admin: { description: 'Smaller text below the main paragraph' },
    },
    {
      name: 'accentColor',
      type: 'text',
      admin: { description: 'Optional hex color override (e.g. #0096C3)' },
    },
  ],
}
