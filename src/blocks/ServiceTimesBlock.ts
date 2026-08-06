import type { Block } from 'payload'

export const ServiceTimesBlock: Block = {
  slug: 'serviceTimes',
  interfaceName: 'ServiceTimesBlock',
  labels: {
    singular: 'Service Times',
    plural: 'Service Times',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      defaultValue: 'Join us this Sunday',
    },
    {
      name: 'services',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 3,
      labels: {
        singular: 'Service',
        plural: 'Services',
      },
      fields: [
        { name: 'campus', type: 'text', required: true },
        {
          name: 'time',
          type: 'text',
          required: true,
          admin: { description: 'Time only, for example 10:15 am.' },
        },
        {
          name: 'href',
          type: 'text',
          required: true,
          admin: { description: 'Campus page path, for example /campus/north.' },
        },
      ],
    },
  ],
}
