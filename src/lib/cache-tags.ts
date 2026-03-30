/**
 * Cache tag constants for ISR revalidation.
 * Use with `revalidateTag()` to bust specific caches
 * when synced data changes.
 */

export const CACHE_TAGS = {
  campuses: 'campuses',
  events: 'events',
  teamMembers: 'team-members',
  sermonSeries: 'sermon-series',
  sermons: 'sermons',
  speakers: 'speakers',
  topics: 'topics',
  categories: 'categories',
  scriptures: 'scriptures',
  connectGroups: 'connect-groups',
  registrations: 'registrations',
  pages: 'pages',
  blogPosts: 'blog-posts',
  announcements: 'announcements',
  navigation: 'navigation',
  siteSettings: 'site-settings',
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]
