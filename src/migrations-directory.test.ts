import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Payload migration directory', () => {
  it('contains no test modules that Payload would import during startup', () => {
    const migrationDirectory = resolve(process.cwd(), 'src/migrations')
    const testModules = readdirSync(migrationDirectory).filter((fileName) =>
      /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(fileName),
    )

    expect(testModules).toEqual([])
  })
})
