import type { Block } from 'payload'

export const GospelStepperBlock: Block = {
  slug: 'gospelStepper',
  interfaceName: 'GospelStepperBlock',
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: { description: 'Heading shown above the stepper' },
    },
    {
      name: 'steps',
      type: 'array',
      required: true,
      minRows: 2,
      maxRows: 8,
      fields: [
        {
          name: 'stepTitle',
          type: 'text',
          required: true,
          admin: { description: 'Short label shown in progress indicator' },
        },
        {
          name: 'heading',
          type: 'text',
          required: true,
        },
        {
          name: 'body',
          type: 'richText',
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'imagePosition',
          type: 'select',
          defaultValue: 'right',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
            { label: 'Background', value: 'background' },
          ],
        },
      ],
    },
    {
      name: 'finalCTA',
      type: 'group',
      fields: [
        {
          name: 'heading',
          type: 'text',
        },
        {
          name: 'text',
          type: 'textarea',
        },
        {
          name: 'buttons',
          type: 'array',
          maxRows: 3,
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
      ],
    },
  ],
}
