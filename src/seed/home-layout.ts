interface SeedBlock {
  blockType?: string
  [key: string]: unknown
}

const upcomingEventsBlock: SeedBlock = {
  blockType: 'upcomingEvents',
  eyebrow: 'What’s on',
  heading: 'Upcoming events',
}

const serviceTimesBlock: SeedBlock = {
  blockType: 'serviceTimes',
  heading: 'Join us this Sunday',
  services: [
    { campus: 'North', time: '10:15 am', href: '/campus/north' },
    { campus: 'Central', time: '10:15 am', href: '/campus/central' },
    { campus: 'Unichurch', time: '5:15 pm', href: '/campus/unichurch' },
  ],
}

export function ensureServiceTimesBlock(layout: SeedBlock[]): SeedBlock[] {
  if (layout.some((block) => block.blockType === 'serviceTimes')) return layout

  const heroIndex = layout.findIndex((block) => block.blockType === 'hero')
  const insertionIndex = heroIndex === -1 ? 0 : heroIndex + 1

  return [
    ...layout.slice(0, insertionIndex),
    serviceTimesBlock,
    ...layout.slice(insertionIndex),
  ]
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
