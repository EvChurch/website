import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const railwayConfig = readFileSync(
  new URL('../railway.toml', import.meta.url),
  'utf8',
)

describe('Railway website deployment', () => {
  it('waits for the application and database before switching traffic', () => {
    expect(railwayConfig).toMatch(
      /\[deploy\][\s\S]*healthcheckPath\s*=\s*"\/api\/health"/,
    )
  })
})
