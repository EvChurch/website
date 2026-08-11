import type { Block } from 'payload'

export const DailyReadingBlock: Block = {
  slug: 'dailyReading',
  interfaceName: 'DailyReadingBlock',
  labels: { singular: 'Daily Bible Reading', plural: 'Daily Bible Reading' },
  fields: [
    { name: 'eyebrow', type: 'text', defaultValue: 'A word from God for you today' },
    { name: 'heading', type: 'text', defaultValue: 'Make room for the word.' },
  ],
}
