import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const railwayConfig = readFileSync(
  new URL('../railway.toml', import.meta.url),
  'utf8',
)
const buildCommand = railwayConfig.match(
  /^buildCommand\s*=\s*"([^"]+)"$/m,
)?.[1]
const clearDataCacheScript = fileURLToPath(
  new URL('../scripts/clear-next-data-cache.mjs', import.meta.url),
)
const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('Railway website deployment', () => {
  it('clears persisted Next.js data before prerendering Payload pages', () => {
    const clearDataCache = 'node scripts/clear-next-data-cache.mjs'
    const nextBuild = 'pnpm run build'

    expect(buildCommand).toBeDefined()
    expect(buildCommand).toContain(clearDataCache)
    expect(buildCommand?.indexOf(clearDataCache)).toBeLessThan(
      buildCommand?.indexOf(nextBuild) ?? -1,
    )
  })

  it('preserves the Next.js compiler cache while removing persisted page data', () => {
    const projectDirectory = mkdtempSync(join(tmpdir(), 'ev-church-build-cache-'))
    temporaryDirectories.push(projectDirectory)
    const dataCache = join(projectDirectory, '.next/cache/fetch-cache')
    const compilerCache = join(projectDirectory, '.next/cache/turbopack')
    mkdirSync(dataCache, { recursive: true })
    mkdirSync(compilerCache, { recursive: true })
    writeFileSync(join(dataCache, 'stale-page'), 'old Payload page')
    writeFileSync(join(compilerCache, 'compiler-artifact'), 'keep me')

    execFileSync(process.execPath, [clearDataCacheScript], {
      cwd: projectDirectory,
    })

    expect(existsSync(dataCache)).toBe(false)
    expect(existsSync(join(compilerCache, 'compiler-artifact'))).toBe(true)
  })

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
