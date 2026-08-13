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

  it('runs migrations without seeding production content', () => {
    expect(railwayConfig).toContain(
      'startCommand = "pnpm run payload migrate && pnpm start"',
    )
    expect(railwayConfig).not.toMatch(/(?:pnpm\s+seed|src\/seed\/)/)
  })
})
