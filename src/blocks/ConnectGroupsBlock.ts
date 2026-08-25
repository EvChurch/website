import type { Block } from 'payload'

export const ConnectGroupsBlock: Block = {
  slug: 'connectGroups',
  interfaceName: 'ConnectGroupsBlock',
  labels: {
    singular: 'Connect Groups',
    plural: 'Connect Groups',
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      defaultValue: 'Find your people',
    },
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Find a Connect Group',
    },
    {
      name: 'description',
      type: 'textarea',
      defaultValue:
        'Explore Connect Groups across Auckland and choose one that works for you.',
    },
  ],
}
