import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const EVENT_PAGES = [
  'src/app/(frontend)/events/page.tsx',
  'src/app/(frontend)/events/north/page.tsx',
  'src/app/(frontend)/events/central/page.tsx',
  'src/app/(frontend)/events/unichurch/page.tsx',
  'src/app/(frontend)/events/[slug]/page.tsx',
]

describe('public event route cache contract', () => {
  it.each(EVENT_PAGES)('%s uses the short ISR fallback', (path) => {
    const source = readFileSync(join(process.cwd(), path), 'utf8')

    expect(source).toContain('export const revalidate = 300')
    expect(source).not.toContain("export const dynamic = 'force-dynamic'")
  })
})
