import { Readable } from 'node:stream'
import { createRequire } from 'node:module'
import type { GetObjectCommandOutput } from '@aws-sdk/client-s3'
import type { User } from '@/payload-types'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { payloadStorageKey } from '@/lib/payload-storage-key'
import { PAYLOAD_390_UPLOAD_KEYS_UP_SQL } from '../migrations/20261010_010000_payload_390_upload_keys'

const storage = vi.hoisted(() => ({
  objects: new Map<string, { body: Buffer; type: string }>(),
  put: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
}))


const databaseUrl = process.env.PAYLOAD_SECURITY_S3_TEST_DATABASE_URL
const context = { skipCacheInvalidation: true, skipBlurGeneration: true }
const uploads = [
  { collection: 'media', table: 'media', filename: 'legacy.png', mimeType: 'image/png', prefix: '' },
  { collection: 'sermon-audio', table: 'sermon_audio', filename: 'legacy.txt', mimeType: 'text/plain', prefix: '' },
  { collection: 'sermon-work-files', table: 'sermon_work_files', filename: 'legacy.wav', mimeType: 'audio/wav', prefix: 'sermon-work' },
] as const

function wav() {
  const body = Buffer.alloc(44 + 200)
  body.write('RIFF', 0); body.writeUInt32LE(body.length - 8, 4); body.write('WAVEfmt ', 8)
  body.writeUInt32LE(16, 16); body.writeUInt16LE(1, 20); body.writeUInt16LE(1, 22)
  body.writeUInt32LE(8000, 24); body.writeUInt32LE(16000, 28); body.writeUInt16LE(2, 32); body.writeUInt16LE(16, 34)
  body.write('data', 36); body.writeUInt32LE(200, 40)
  return body
}

describe.skipIf(!databaseUrl)('Payload S3 schema migration with in-memory storage', () => {
  let client: Client
  let payload: Payload
  let admin: User & { collection: 'users' }
  let editor: User & { collection: 'users' }
  const bodies = new Map<string, Buffer>()
  const replacements = new Map<string, Buffer>()

  beforeAll(async () => {
    const url = new URL(databaseUrl!)
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/payload_security_storage_test' ||
      process.env.PAYLOAD_SECURITY_TEST_FIXTURE !== 'synthetic-pr350' || process.env.DATABASE_URL !== databaseUrl ||
      process.env.S3_BUCKET !== 'synthetic-pr350' || process.env.S3_ENDPOINT !== 'http://127.0.0.1:57151') {
      throw new Error('Use only the private synthetic storage fixture.')
    }
    // No HTTP, credentials provider, or real S3 request is allowed by this fixture.
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('External fetch forbidden in storage fixture') }))
    // The adapter can carry its own exact SDK version. Mock its actual client
    // prototype, rather than assuming it resolves the application's SDK copy.
    const requireStorage = createRequire(import.meta.resolve('@payloadcms/storage-s3'))
    const sdk: typeof import('@aws-sdk/client-s3') = await import(requireStorage.resolve('@aws-sdk/client-s3'))
    vi.spyOn(sdk.S3.prototype, 'putObject').mockImplementation(async input => {
      storage.put(input.Key)
      if (!input.Key || !Buffer.isBuffer(input.Body)) throw new Error('Expected a synthetic buffered upload')
      storage.objects.set(input.Key, { body: input.Body, type: input.ContentType! })
      return { $metadata: {} }
    })
    vi.spyOn(sdk.S3.prototype, 'headObject').mockImplementation(async input => {
      const object = storage.objects.get(input.Key!)
      if (!object) throw Object.assign(new Error('Synthetic object missing'), { name: 'NoSuchKey' })
      return { $metadata: {}, ContentLength: object.body.length, ContentType: object.type }
    })
    vi.spyOn(sdk.S3.prototype, 'getObject').mockImplementation(async input => {
      storage.get(input.Key)
      const object = storage.objects.get(input.Key!)
      if (!object) throw Object.assign(new Error('Synthetic object missing'), { name: 'NoSuchKey' })
      return { $metadata: {}, Body: Readable.from([object.body]) as GetObjectCommandOutput['Body'] }
    })
    vi.spyOn(sdk.S3.prototype, 'deleteObject').mockImplementation(async input => {
      storage.remove(input.Key)
      storage.objects.delete(input.Key!)
      return { $metadata: {} }
    })
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
    // The historical build fixture was generated without S3; restore the
    // pre-upgrade S3 prefix column already supplied by the sermon manager migration.
    await client.query("ALTER TABLE sermon_work_files ADD COLUMN IF NOT EXISTS prefix varchar DEFAULT 'sermon-work'")
    bodies.set('media', await sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#E22A30' } }).png().toBuffer())
    replacements.set('media', await sharp({ create: { width: 800, height: 800, channels: 3, background: '#0F0004' } }).png().toBuffer())
    bodies.set('sermon-audio', Buffer.from('Synthetic sermon transcript'))
    replacements.set('sermon-audio', Buffer.from('Distinct replacement sermon transcript'))
    bodies.set('sermon-work-files', wav())
    const replacementAudio = wav()
    replacementAudio.writeInt16LE(100, 44)
    replacements.set('sermon-work-files', replacementAudio)
    for (const upload of uploads) {
      await client.query(`ALTER TABLE ${upload.table} DROP COLUMN IF EXISTS _objectkey`)
      await client.query(`INSERT INTO ${upload.table}(filename,mime_type,filesize${upload.collection === 'media' ? ',alt' : ''}) VALUES($1,$2,$3${upload.collection === 'media' ? ",'Legacy synthetic image'" : ''})`,
        [upload.filename, upload.mimeType, bodies.get(upload.collection)!.length])
      storage.objects.set(payloadStorageKey(upload, upload.prefix), { body: bodies.get(upload.collection)!, type: upload.mimeType })
    }
    await client.query('BEGIN')
    await client.query(PAYLOAD_390_UPLOAD_KEYS_UP_SQL)
    await client.query('COMMIT')
    const { default: config } = await import('../../payload.config')
    payload = await getPayload({ config })
    async function user(name: string, roles: User['roles']) {
      const doc = await payload.create({ collection: 'users', data: {
        name, roles, email: `${name}@example.invalid`, auth0IdentityKey: name,
        auth0Issuer: 'https://synthetic.invalid', auth0Subject: name,
      } })
      return { ...doc, collection: 'users' as const }
    }
    admin = await user('storage-admin', ['admin'])
    editor = await user('storage-editor', ['editor'])
  }, 60_000)

  afterAll(async () => {
    await payload?.destroy()
    await client?.end()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each(uploads)('reads migrated legacy files, stores and replaces files with the actual $collection adapter', async upload => {
    const config = payload.collections[upload.collection].config
    expect(config.flattenedFields.map(field => field.name)).toContain('_objectKey')
    const legacy = (await payload.find({ collection: upload.collection, where: { filename: { equals: upload.filename } }, depth: 0 })).docs[0]
    expect(legacy._objectKey).toBeNull()
    const staticHandler = typeof config.upload === 'object' && config.upload.handlers?.[0]
    if (!staticHandler) throw new Error('Actual S3 handler missing')
    const read = async (doc: typeof legacy, body = bodies.get(upload.collection)) => {
      const req = await createLocalReq({}, payload)
      const response = await staticHandler(req, { doc, headers: new Headers(), params: { collection: upload.collection, filename: doc.filename! } })
      expect(response).toBeInstanceOf(Response)
      if (!(response instanceof Response)) throw new Error('No storage response')
      expect(response.status).toBe(200)
      expect(Buffer.from(await response.arrayBuffer())).toEqual(body)
      expect(storage.get).toHaveBeenLastCalledWith(payloadStorageKey(doc, upload.prefix))
    }
    await read(legacy)
    const body = bodies.get(upload.collection)!
    const user = upload.collection === 'media' ? editor : admin
    const created = await payload.create({ collection: upload.collection, context: { ...context }, overrideAccess: false, user,
      data: upload.collection === 'media' ? { alt: 'New synthetic image' } : {},
      file: { data: body, mimetype: upload.mimeType, name: `new-${upload.filename}`, size: body.length }, depth: 0 })
    expect(storage.put).toHaveBeenCalledWith(payloadStorageKey(created, upload.prefix))
    await read(created)
    const putCount = storage.put.mock.calls.length
    const deleteCount = storage.remove.mock.calls.length
    const tampering = payload.update({ collection: upload.collection, id: created.id, context: { ...context }, overrideAccess: false, user,
      data: { filename: 'forged.wav', mimeType: 'text/html', prefix: 'forged', _objectKey: 'forged' } })
    if (upload.collection === 'sermon-work-files') await expect(tampering).rejects.toThrow()
    else {
      await expect(tampering).rejects.toThrow(/MIME Type/)
      await payload.update({ collection: upload.collection, id: created.id, context: { ...context }, overrideAccess: false, user,
        data: { filename: 'forged.wav', prefix: 'forged', _objectKey: 'forged' } })
    }
    const unchanged = await payload.findByID({ collection: upload.collection, id: created.id, depth: 0 })
    expect(payloadStorageKey(unchanged, upload.prefix)).toBe(payloadStorageKey(created, upload.prefix))
    expect(unchanged.mimeType).toBe(created.mimeType)
    expect(storage.put.mock.calls).toHaveLength(putCount)
    expect(storage.remove.mock.calls).toHaveLength(deleteCount)
    // The application disables clientUploads. Represent an already persisted
    // per-upload folder to test reads and replacements without enabling them.
    const objectKey = 'persisted-upload-folder'
    await client.query(`UPDATE ${upload.table} SET _objectkey=$1 WHERE id=$2`, [objectKey, created.id])
    storage.objects.set([upload.prefix, objectKey, created.filename].filter(Boolean).join('/'), { body, type: upload.mimeType })
    const sizes = 'sizes' in created ? Object.values(created.sizes ?? {}).filter(size => size?.filename) : []
    const sizeKeys: string[] = []
    for (const size of sizes) {
      const oldKey = payloadStorageKey({ filename: size.filename }, upload.prefix)
      const key = payloadStorageKey({ filename: size.filename, _objectKey: objectKey }, upload.prefix)
      storage.objects.set(key, storage.objects.get(oldKey)!)
      sizeKeys.push(key)
    }
    const keyed = await payload.findByID({ collection: upload.collection, id: created.id, depth: 0 })
    expect(keyed._objectKey).toBe(objectKey)
    await read(keyed)
    if (upload.collection === 'media') {
      expect(sizeKeys.length).toBeGreaterThan(0)
      const req = await createLocalReq({}, payload)
      const response = await staticHandler(req, { doc: keyed, headers: new Headers(), params: { collection: upload.collection, filename: sizes[0].filename! } })
      if (!(response instanceof Response)) throw new Error('No thumbnail response')
      expect(response.status).toBe(200)
      expect(Buffer.from(await response.arrayBuffer())).toEqual(storage.objects.get(sizeKeys[0])!.body)
      expect(storage.get).toHaveBeenLastCalledWith(sizeKeys[0])
    }
    const replacement = replacements.get(upload.collection)!
    expect(replacement).not.toEqual(body)
    // Private work-file replacements remain trusted server operations; their
    // request-scoped update access is denied above, including for an admin.
    const replaced = await payload.update({ collection: upload.collection, id: created.id, context: { ...context }, data: {},
      overrideAccess: upload.collection === 'sermon-work-files', user,
      file: { data: replacement, mimetype: upload.mimeType, name: `replacement-${upload.filename}`, size: replacement.length }, depth: 0 })
    expect(storage.put).toHaveBeenCalledWith(payloadStorageKey(replaced, upload.prefix))
    expect(storage.remove).toHaveBeenCalledWith(payloadStorageKey(keyed, upload.prefix))
    for (const key of sizeKeys) expect(storage.remove).toHaveBeenCalledWith(key)
    const persisted = await payload.findByID({ collection: upload.collection, id: replaced.id, depth: 0 })
    expect(persisted).toMatchObject({ filename: replaced.filename, _objectKey: replaced._objectKey, filesize: replacement.length })
    await read(persisted, replacement)
    await payload.delete({ collection: upload.collection, id: replaced.id, context: { ...context } })
    expect(storage.remove).toHaveBeenCalledWith(payloadStorageKey(replaced, upload.prefix))
    expect((await payload.findByID({ collection: upload.collection, id: legacy.id, depth: 0 })).filename).toBe(upload.filename)
    expect(storage.objects.has(payloadStorageKey(legacy, upload.prefix))).toBe(true)
  })
})
