import type { Block } from 'payload'

export const PageHeaderBlock: Block = {
  slug: 'pageHeader',
  interfaceName: 'PageHeaderBlock',
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
    },
    {
      name: 'heading',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'keyColor',
      type: 'text',
      admin: { description: 'Hex colour override for eyebrow accent (e.g. #0096C3)' },
    },
    {
      name: 'theme',
      type: 'select',
      defaultValue: 'dark',
      options: [
        { label: 'Dark', value: 'dark' },
        { label: 'Light', value: 'light' },
      ],
    },
  ],
}
