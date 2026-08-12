import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PRIVATE_HREF = /href=(?:["']\/(?:auth|member-auth|member-avatar|member-sign-in|members)(?:\/|[?"'])|\{`\/(?:auth|member-auth|member-avatar|member-sign-in|members)(?:\/|[?`]))/u

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return tsxFiles(path)
    return extname(path) === '.tsx' && !path.endsWith('.test.tsx') ? [path] : []
  })
}

describe('private crawler links', () => {
  it('marks every literal private or authentication link as nofollow', () => {
    const missing = tsxFiles(join(process.cwd(), 'src')).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      const tags = source.match(/<(?:a|Link)\b[^>]*>/gu) ?? []
      return tags
        .filter((tag) => PRIVATE_HREF.test(tag) && !/rel=["']nofollow["']/u.test(tag))
        .map((tag) => `${path.replace(`${process.cwd()}/`, '')}: ${tag.replace(/\s+/gu, ' ')}`)
    })

    expect(missing).toEqual([])
  })
})
