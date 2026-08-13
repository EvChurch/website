import { notFound } from 'next/navigation'
import { after } from 'next/server'

import { recordMissingPublicPath } from '@/lib/missing-paths'

export function publicNotFound(...segments: string[]): never {
  const path = `/${segments.map(encodeURIComponent).join('/')}`
  after(async () => {
    try {
      await recordMissingPublicPath(path)
    } catch {
      console.error({
        category: 'missing-path-write-failed',
        path,
      })
    }
  })
  notFound()
}
