import type { Block } from 'payload'

export const UpcomingEventsBlock: Block = {
  slug: 'upcomingEvents',
  interfaceName: 'UpcomingEventsBlock',
  labels: {
    singular: 'Upcoming Events',
    plural: 'Upcoming Events',
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      defaultValue: 'What’s on',
    },
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Upcoming events',
    },
    {
      name: 'campusFilter',
      type: 'relationship',
      relationTo: 'campuses',
      admin: {
        description: 'Optional. Events without a campus are included for every campus.',
      },
    },
  ],
}
