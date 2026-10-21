export const DEFAULT_OPEN_GRAPH_IMAGE_ALT =
  'Ev Church — a community of Christ-followers across Auckland'
export const DEFAULT_OPEN_GRAPH_IMAGE_SIZE = { width: 1200, height: 630 }

export const DEFAULT_OPEN_GRAPH_IMAGES = [
  {
    url: '/og-image',
    ...DEFAULT_OPEN_GRAPH_IMAGE_SIZE,
    alt: DEFAULT_OPEN_GRAPH_IMAGE_ALT,
  },
]

export function truncateMetaDescription(value: string, maxLength = 160): string {
  if (value.length <= maxLength) return value

  const shortened = value.slice(0, maxLength - 1)
  const lastSpace = shortened.lastIndexOf(' ')
  const boundary = lastSpace > 0 ? lastSpace : shortened.length

  return `${shortened.slice(0, boundary).replace(/[,:;.]$/u, '')}…`
}

/** Keep full subjects when possible by dropping the generic section suffix first. */
export function buildSermonMetaTitle(title: string, section: 'Sermons' | 'Sermon Series'): string {
  const fullTitle = `${title} | ${section} | Ev Church`
  if (fullTitle.length <= 70) return fullTitle

  const suffix = ' | Ev Church'
  return `${truncateMetaDescription(title, 70 - suffix.length)}${suffix}`
}
