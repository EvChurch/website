import type { Block } from 'payload'
import { isGuid } from '@/lib/rock-forms/constants'

export const FormEmbedBlock: Block = {
  slug: 'formEmbed',
  interfaceName: 'FormEmbedBlock',
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
      name: 'rockWorkflowGuid',
      type: 'text',
      required: true,
      validate: (value: unknown) =>
        typeof value === 'string' && isGuid(value)
          ? true
          : 'Choose a public Rock Form Builder workflow.',
      admin: {
        description:
          'The active public Rock Form Builder workflow rendered and submitted directly to Rock.',
        components: {
          Field: '@/components/admin/RockWorkflowPicker#RockWorkflowPicker',
        },
      },
    },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'centered',
      options: [
        { label: 'Full width', value: 'full' },
        { label: 'Centered', value: 'centered' },
      ],
    },
  ],
}
