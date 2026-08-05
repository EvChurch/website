interface SeedBlock {
  blockType?: string
  [key: string]: unknown
}

const upcomingEventsBlock: SeedBlock = {
  blockType: 'upcomingEvents',
  eyebrow: 'What’s on',
  heading: 'Upcoming events',
}

export function ensureUpcomingEventsBlock(layout: SeedBlock[]): SeedBlock[] {
  if (layout.some((block) => block.blockType === 'upcomingEvents')) return layout

  const latestSermonIndex = layout.findIndex((block) => block.blockType === 'latestSermon')
  const insertionIndex = latestSermonIndex === -1 ? layout.length : latestSermonIndex + 1

  return [
    ...layout.slice(0, insertionIndex),
    upcomingEventsBlock,
    ...layout.slice(insertionIndex),
  ]
}
