import type { Block } from 'payload'

export const LatestSermonBlock: Block = {
  slug: 'latestSermon',
  interfaceName: 'LatestSermonBlock',
  fields: [
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Latest Sermon',
      admin: {
        description: 'Section heading displayed above the sermon',
      },
    },
  ],
}
