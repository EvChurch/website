import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { configToJSONSchema, createLocalReq, getPayload, type Payload, type PayloadRequest, type TypedUser } from 'payload'
import { z } from 'zod'
import sharp from 'sharp'
import type { MCPAccessSettings, MCPPluginConfig } from '@payloadcms/plugin-mcp'
import type { User } from '@/payload-types'
import { PAYLOAD_390_UPLOAD_KEYS_UP_SQL } from '../migrations/20261010_010000_payload_390_upload_keys'

const databaseUrl = process.env.PAYLOAD_SECURITY_TEST_DATABASE_URL

interface ToolResult { content: { type: string; text: string }[] }
interface RegisteredTool {
  inputSchema: z.ZodRawShape
  handler: (input: Record<string, unknown>) => Promise<ToolResult>
}
type ToolBuilder = (
  server: { registerTool: (name: string, options: { inputSchema: z.ZodRawShape }, handler: RegisteredTool['handler']) => void },
  req: PayloadRequest,
  user: TypedUser,
  verbose: boolean,
  slug: string,
  collections: MCPPluginConfig['collections'],
  schema: unknown,
) => void

// Exercise the installed plugin implementations, rather than copies of their
// access logic. Its internal tool builders have no public package export.
async function toolBuilder(operation: 'create' | 'update' | 'find' | 'delete'): Promise<ToolBuilder> {
  const module: Record<string, ToolBuilder> = await import(new URL(
    `./mcp/tools/resource/${operation}.js`, import.meta.resolve('@payloadcms/plugin-mcp'),
  ).href)
  return module[`${operation}ResourceTool`]
}

describe.skipIf(!databaseUrl)('Payload 3.90 security compatibility on disposable PostgreSQL', () => {
  let client: Client
  let payload: Payload
  let admin: User & { collection: 'users' }
  let editor: User & { collection: 'users' }
  let viewer: User & { collection: 'users' }
  let pageId: number
  const unique = randomUUID()
  const context = { skipCacheInvalidation: true, skipBlurGeneration: true }

  beforeAll(async () => {
    const url = new URL(databaseUrl!)
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.pathname !== '/payload_security_test' ||
      process.env.PAYLOAD_SECURITY_TEST_FIXTURE !== 'synthetic-pr350' ||
      process.env.DATABASE_URL !== databaseUrl || process.env.S3_BUCKET) {
      throw new Error('Use only the isolated synthetic payload_security_test database without external storage.')
    }
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
    const { default: config } = await import('../../payload.config')
    payload = await getPayload({ config })
    async function user(name: string, roles: User['roles']) {
      const doc = await payload.create({ collection: 'users', data: {
        name, email: `${name}-${unique}@example.invalid`, roles,
        auth0IdentityKey: `${name}-${unique}`, auth0Issuer: 'https://synthetic.invalid', auth0Subject: name,
      } })
      return { ...doc, collection: 'users' as const }
    }
    admin = await user('admin', ['admin'])
    editor = await user('editor', ['editor'])
    viewer = await user('viewer', [])
    pageId = (await payload.create({ collection: 'pages', data: { title: 'Private draft', slug: `security-${unique}`, _status: 'draft' }, context })).id
  }, 60_000)

  afterAll(async () => {
    await payload?.destroy()
    await client?.end()
  })

  it('adds nullable upload columns idempotently without rewriting prior users, keys or upload paths', async () => {
    await client.query('BEGIN')
    try {
      await client.query(`CREATE SCHEMA payload_390_legacy_fixture; SET LOCAL search_path TO payload_390_legacy_fixture;
        CREATE TABLE users(id integer PRIMARY KEY, name varchar, auth0_identity_key varchar);
        CREATE TABLE payload_mcp_api_keys(id integer PRIMARY KEY, user_id integer REFERENCES users(id), api_key varchar, api_key_index varchar);
        CREATE TABLE media(id integer PRIMARY KEY, filename varchar, prefix varchar);
        CREATE TABLE sermon_audio(id integer PRIMARY KEY, filename varchar);
        CREATE TABLE sermon_work_files(id integer PRIMARY KEY, filename varchar, prefix varchar);
        INSERT INTO users VALUES(1,'Prior user','unchanged-identity');
        INSERT INTO payload_mcp_api_keys VALUES(1,1,'prior-encrypted-key','prior-index');
        INSERT INTO media VALUES(1,'old.jpg','people');
        INSERT INTO sermon_audio VALUES(1,'old.mp3');
        INSERT INTO sermon_work_files VALUES(1,'private.mp3','sermon-work');`)
      await client.query(PAYLOAD_390_UPLOAD_KEYS_UP_SQL)
      await client.query(PAYLOAD_390_UPLOAD_KEYS_UP_SQL)
      expect((await client.query('SELECT * FROM users')).rows).toEqual([{ id: 1, name: 'Prior user', auth0_identity_key: 'unchanged-identity' }])
      expect((await client.query('SELECT * FROM payload_mcp_api_keys')).rows).toEqual([{ id: 1, user_id: 1, api_key: 'prior-encrypted-key', api_key_index: 'prior-index' }])
      expect((await client.query('SELECT filename,prefix,_objectkey FROM media')).rows).toEqual([{ filename: 'old.jpg', prefix: 'people', _objectkey: null }])
      for (const table of ['media', 'sermon_audio', 'sermon_work_files']) {
        expect((await client.query(`SELECT _objectkey FROM ${table}`)).rows).toEqual([{ _objectkey: null }])
        await client.query(`UPDATE ${table} SET _objectkey='synthetic-new-upload' WHERE id=1`)
      }
    } finally { await client.query('ROLLBACK') }
  })

  it('retains Auth0-only users and API-key-only MCP authentication without password reset schema', async () => {
    for (const slug of ['users', 'payload-mcp-api-keys'] as const) {
      const config = payload.collections[slug].config
      expect(config.auth.disableLocalStrategy).toBe(true)
      expect(config.flattenedFields.map(field => field.name)).not.toContain('resetPasswordRequestedAt')
    }
    await expect(payload.login({ collection: 'users', data: { email: admin.email, password: 'synthetic' } })).rejects.toThrow()
  })

  it('binds new keys to the creating admin, blocks re-binding and denies non-admin key management', async () => {
    const key = await payload.create({ collection: 'payload-mcp-api-keys', overrideAccess: false, user: admin,
      data: { user: editor.id, label: 'owner-bound synthetic key', apiKey: `synthetic-${unique}`, pages: { find: true } }, depth: 0 })
    expect(key.user).toBe(admin.id)
    const updated = await payload.update({ collection: 'payload-mcp-api-keys', id: key.id,
      overrideAccess: false, user: admin, data: { user: editor.id }, depth: 0 })
    expect(updated.user).toBe(admin.id)
    expect(updated.apiKey).toBeUndefined()
    expect(updated.apiKeyIndex).toBeUndefined()
    for (const user of [editor, viewer]) {
      await expect(payload.create({ collection: 'payload-mcp-api-keys', overrideAccess: false, user,
        data: { user: user.id, label: 'denied' } })).rejects.toThrow()
      await expect(payload.find({ collection: 'payload-mcp-api-keys', overrideAccess: false, user })).rejects.toThrow()
      await expect(payload.update({ collection: 'payload-mcp-api-keys', id: key.id, overrideAccess: false, user, data: { label: 'denied' } })).rejects.toThrow()
      await expect(payload.delete({ collection: 'payload-mcp-api-keys', id: key.id, overrideAccess: false, user })).rejects.toThrow()
    }
    const module: { resolveAccessSettings: (args: { pluginOptions: MCPPluginConfig; req: PayloadRequest; useVerboseLogs: boolean }) => Promise<MCPAccessSettings> } = await import(new URL('./endpoints/resolveAccessSettings.js', import.meta.resolve('@payloadcms/plugin-mcp')).href)
    const req = await createLocalReq({ req: { headers: new Headers({ Authorization: `Bearer synthetic-${unique}` }) } }, payload)
    const access = await module.resolveAccessSettings({ pluginOptions: { userCollection: 'users' }, req, useVerboseLogs: false })
    expect(access.user).toMatchObject({ id: admin.id, collection: 'users', _strategy: 'mcp-api-key' })
    req.headers = new Headers({ Authorization: 'Bearer invalid-synthetic-key' })
    await expect(module.resolveAccessSettings({ pluginOptions: { userCollection: 'users' }, req, useVerboseLogs: false })).rejects.toThrow()
  })

  async function tool(operation: 'create' | 'update' | 'find' | 'delete', slug: string, user: TypedUser) {
    let registered: RegisteredTool | undefined
    const req = await createLocalReq({ user: admin, context }, payload)
    const schema = configToJSONSchema(payload.config, payload.db.defaultIDType).definitions?.[slug]
    const server = { registerTool: (_name: string, options: { inputSchema: z.ZodRawShape }, handler: RegisteredTool['handler']) => { registered = { ...options, handler } } }
    ;(await toolBuilder(operation))(server, req, user, false, slug, { [slug]: { enabled: true } }, schema)
    if (!registered) throw new Error('MCP tool was not registered.')
    return registered
  }

  it('enforces the key owner access even when a browser admin is on the request', async () => {
    const create = await tool('create', 'pages', editor)
    const denied = await create.handler(z.object(create.inputSchema).parse({ title: 'Denied', slug: `denied-${unique}` }))
    expect(denied.content[0].text).toMatch(/error/i)
    const update = await tool('update', 'pages', editor)
    expect(update.inputSchema).not.toHaveProperty('filePath')
    expect(update.inputSchema).not.toHaveProperty('overwriteExistingFiles')
    const allowed = await update.handler(z.object(update.inputSchema).parse({ id: pageId, title: 'Allowed editor update' }))
    expect(allowed.content[0].text).not.toMatch(/^Error/)
    expect((await payload.findByID({ collection: 'pages', id: pageId })).title).toBe('Allowed editor update')
    const remove = await tool('delete', 'pages', editor)
    expect((await remove.handler(z.object(remove.inputSchema).parse({ id: pageId }))).content[0].text).toMatch(/error/i)
    const read = await tool('find', 'pages', viewer)
    const hidden = await read.handler(z.object(read.inputSchema).parse({ id: pageId }))
    expect(hidden.content[0].text).not.toContain('Allowed editor update')
    expect((await payload.findByID({ collection: 'pages', id: pageId }))._status).toBe('draft')
  })

  it('initializes the real HTTP MCP handler and enforces key-owner access through registered tools', async () => {
    type Endpoint = (req: PayloadRequest) => Promise<Response>
    const module: { initializeMCPHandler: (options: MCPPluginConfig) => Endpoint } = await import(new URL(
      './endpoints/mcp.js', import.meta.resolve('@payloadcms/plugin-mcp'),
    ).href)
    const token = `transport-${unique}`
    // Trusted fixture setup represents a historical editor-owned key. The
    // preceding test verifies that editors cannot create keys through requests.
    await payload.create({ collection: 'payload-mcp-api-keys', user: editor,
      data: { user: editor.id, label: 'Synthetic transport key', apiKey: token,
        pages: { find: true, create: true, update: true, delete: true } } })
    const endpoint = module.initializeMCPHandler({ collections: { pages: { enabled: true } },
      userCollection: 'users', mcp: { handlerOptions: { disableSse: true } } })
    interface RPCResult { result?: { tools?: { name: string }[]; content?: { text: string }[]; protocolVersion?: string }; error?: unknown }
    async function rpc(method: string, params: Record<string, unknown>, bearer = token, expectedStatus = 200): Promise<RPCResult> {
      const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      const req = await createLocalReq({ user: admin, context: { ...context }, req: {
        url: 'http://127.0.0.1/api/mcp', method: 'POST',
        body: new Request('http://127.0.0.1/api/mcp', { method: 'POST', body }).body!,
        headers: new Headers({ Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' }),
      } }, payload)
      const response = await endpoint(req)
      expect(req.user?.id).toBe(editor.id)
      expect(response.status).toBe(expectedStatus)
      const text = await response.text()
      return JSON.parse(text.startsWith('event:') || text.startsWith('data:')
        ? text.split('\n').find(line => line.startsWith('data:'))!.slice(5).trim() : text)
    }
    const initialized = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {},
      clientInfo: { name: 'synthetic-security-fixture', version: '1.0.0' } })
    expect(initialized.result?.protocolVersion).toBe('2025-06-18')
    expect((await rpc('tools/list', {})).result?.tools?.map(tool => tool.name)).toEqual(
      expect.arrayContaining(['findPages', 'createPages', 'updatePages', 'deletePages']))
    const denied = await rpc('tools/call', { name: 'createPages', arguments: { title: 'Denied via HTTP', slug: `http-denied-${unique}` } })
    expect(denied.result?.content?.[0].text).toMatch(/error/i)
    const updated = await rpc('tools/call', { name: 'updatePages', arguments: { id: pageId, title: 'HTTP owner-bound update' } })
    expect(updated.result?.content?.[0].text).not.toMatch(/^Error/)
    expect((await payload.findByID({ collection: 'pages', id: pageId })).title).toBe('HTTP owner-bound update')
    const removed = await rpc('tools/call', { name: 'deletePages', arguments: { id: pageId } })
    expect(removed.result?.content?.[0].text).toMatch(/error/i)
    const oversized = await rpc('tools/call', { name: 'findPages', arguments: { where: ' '.repeat(4 * 1024 * 1024) } }, token, 413)
    expect(oversized.error).toMatchObject({ message: expect.stringContaining('4194304') })
    await expect(rpc('tools/list', {}, 'invalid-synthetic')).rejects.toThrow()
  })

  it('accepts safe SVG and PNG, rejects active SVG and preserves Local API file upload arguments', async () => {
    for (const [name, data, mimetype] of [
      ['safe.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'), 'image/svg+xml'],
      ['safe.png', await sharp({ create: { width: 10, height: 10, channels: 3, background: '#E22A30' } }).png().toBuffer(), 'image/png'],
    ] as const) {
      const media = await payload.create({ collection: 'media', overrideAccess: false, user: editor,
        context, data: { alt: 'Synthetic security fixture' }, file: { data, mimetype, name: `${unique}-${name}`, size: data.length } })
      expect(media.mimeType).toBe(mimetype)
      await payload.delete({ collection: 'media', id: media.id, context })
    }
    const data = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    await expect(payload.create({ collection: 'media', overrideAccess: false, user: editor,
      context, data: { alt: 'Unsafe synthetic fixture' }, file: { data, mimetype: 'image/svg+xml', name: 'unsafe.svg', size: data.length } })).rejects.toThrow()
    const directory = await mkdtemp(path.join(tmpdir(), 'payload-security-upload-'))
    let id: number | undefined
    try {
      const filePath = path.join(directory, `${unique}-local.png`)
      await writeFile(filePath, await sharp({ create: { width: 10, height: 10, channels: 3, background: '#E22A30' } }).png().toBuffer())
      const media = await payload.create({ collection: 'media', context, data: { alt: 'Trusted local upload' }, filePath })
      id = media.id
      const updated = await payload.update({ collection: 'media', id, context, data: { alt: 'Trusted replacement' }, filePath, overwriteExistingFiles: true })
      expect(updated.filename).toBe(media.filename)
      expect(updated.alt).toBe('Trusted replacement')
    } finally {
      if (id) await payload.delete({ collection: 'media', id, context })
      await rm(directory, { recursive: true, force: true })
    }
  })
})
