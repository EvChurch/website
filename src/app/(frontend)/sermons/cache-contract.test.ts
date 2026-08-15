import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const slugPages = [
  ['[slug]/page.tsx', "trackedNotFound('sermons', slug)"],
  ['series/[slug]/page.tsx', "trackedNotFound('sermons', 'series', slug)"],
  ['speakers/[slug]/page.tsx', "trackedNotFound('sermons', 'speakers', slug)"],
  ['topics/[slug]/page.tsx', "trackedNotFound('sermons', 'topics', slug)"],
  ['scriptures/[slug]/page.tsx', "trackedNotFound('sermons', 'scriptures', slug)"],
]

describe('sermon route cache contract', () => {
  it.each(slugPages)('%s uses on-demand ISR without forcing dynamic rendering', (relativePath, trackedPath) => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/(frontend)/sermons', relativePath),
      'utf8',
    )

    expect(source).toContain('export const revalidate = 86400')
    expect(source).toContain('return []')
    expect(source).toContain(trackedPath)
    expect(source).not.toContain("export const dynamic = 'force-dynamic'")
  })

  it('keeps the search and cross-filter index dynamic without caching arbitrary queries', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/(frontend)/sermons/page.tsx'),
      'utf8',
    )

    expect(source).toContain("export const dynamic = 'force-dynamic'")
    expect(source).toContain('searchText: { like: q }')
    expect(source).not.toContain('unstable_cache')
  })
})
