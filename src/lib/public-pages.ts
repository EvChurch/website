const RETIRED_PAGE_SLUGS = new Set(['next-steps'])

export function isRetiredPageSlug(slug: string): boolean {
  return RETIRED_PAGE_SLUGS.has(slug)
}
