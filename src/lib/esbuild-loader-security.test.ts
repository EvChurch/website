import { createRequire } from 'node:module'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

interface Transformed {
  code: string
  map: { version: number; sources: string[]; sourcesContent: string[]; mappings: string }
}
interface CoreUtils {
  transformSync(code: string, source: string, options?: { target: string }): Transformed
  transform(code: string, source: string): Promise<Transformed>
  resolveTsPath(source: string): string | undefined
}
interface Compiler {
  version: string
  context(options: Record<string, never>): Promise<{
    serve(options: { host: string; port: number; servedir: string }): Promise<{ port: number }>
    dispose(): Promise<void>
  }>
}

// Resolve through Payload's real deprecated loader graph so a different top-level
// esbuild cannot make these contracts pass while the vulnerable child remains.
const fromRoot = createRequire(import.meta.url)
const fromAdapter = createRequire(fromRoot.resolve('@payloadcms/db-postgres'))
const fromKit = createRequire(fromAdapter.resolve('drizzle-kit/api'))
const fromLoader = createRequire(fromKit.resolve('@esbuild-kit/esm-loader'))
const core: CoreUtils = fromLoader('@esbuild-kit/core-utils')
const fromCore = createRequire(fromLoader.resolve('@esbuild-kit/core-utils'))
const compiler: Compiler = fromCore('esbuild')

describe('Payload deprecated loader security compatibility', () => {
  it('uses the specifically qualified compiler in the vulnerable child path', () => {
    expect(compiler.version).toBe('0.28.1')
  })

  it('does not permit arbitrary cross-origin reads of its localhost server', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ev-esbuild-cors-'))
    const context = await compiler.context({})
    try {
      await writeFile(join(dir, 'harmless.js'), 'export const fixture = "synthetic public text";')
      const server = await context.serve({ host: '127.0.0.1', port: 0, servedir: dir })
      const response = await fetch(`http://127.0.0.1:${server.port}/harmless.js`, {
        headers: { Origin: 'https://synthetic-attacker.invalid' },
      })
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('synthetic public text')
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    } finally {
      await context.dispose()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps synchronous TypeScript CJS exports, names, target and original source maps', () => {
    const source = 'export class NamedFixture { value: number = 12 }; export const select = (n: { child?: number }) => n.child ?? 7;'
    const output = core.transformSync(source, '/synthetic/config.cts', { target: 'es2017' })
    const module = { exports: {} }
    runInNewContext(output.code, { module, exports: module.exports })
    expect(module.exports).toMatchObject({ NamedFixture: expect.any(Function), select: expect.any(Function) })
    expect(output.code).not.toContain('??')
    expect(output.map).toMatchObject({ version: 3, sourcesContent: [source] })
    expect(output.map.sources.some((file) => file.endsWith('config.cts'))).toBe(true)
    expect(output.map.mappings.length).toBeGreaterThan(0)
  })

  it('keeps asynchronous TypeScript ESM exports and source maps', async () => {
    const source = 'export const total: number = await Promise.resolve(12);'
    const output = await core.transform(source, '/synthetic/config.mts')
    expect(output.code).toContain('export')
    expect(output.code).toContain('await Promise.resolve(12)')
    expect(output.map).toMatchObject({ version: 3, sourcesContent: [source] })
    expect(output.map.sources.some((file) => file.endsWith('config.mts'))).toBe(true)
  })

  it('preserves resolution to TypeScript extensions and query suffixes', () => {
    expect(core.resolveTsPath('/synthetic/schema.js?version=1')).toBe('/synthetic/schema.ts?version=1')
    expect(core.resolveTsPath('/synthetic/schema.cjs')).toBe('/synthetic/schema.cts')
    expect(core.resolveTsPath('/synthetic/schema.mjs')).toBe('/synthetic/schema.mts')
  })
})
