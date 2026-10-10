import { Readable } from 'node:stream'
import { createRequire } from 'node:module'
import type { GetObjectCommandOutput } from '@aws-sdk/client-s3'
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
  const bodies = new Map<string, Buffer>()

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
    bodies.set('media', await sharp({ create: { width: 10, height: 10, channels: 3, background: '#E22A30' } }).png().toBuffer())
    bodies.set('sermon-audio', Buffer.from('Synthetic sermon transcript'))
    bodies.set('sermon-work-files', wav())
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
    const read = async (doc: typeof legacy) => {
      const req = await createLocalReq({}, payload)
      const response = await staticHandler(req, { doc, headers: new Headers(), params: { collection: upload.collection, filename: doc.filename! } })
      expect(response).toBeInstanceOf(Response)
      if (!(response instanceof Response)) throw new Error('No storage response')
      expect(response.status).toBe(200)
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bodies.get(upload.collection))
      expect(storage.get).toHaveBeenLastCalledWith(payloadStorageKey(doc, upload.prefix))
    }
    await read(legacy)
    const body = bodies.get(upload.collection)!
    const created = await payload.create({ collection: upload.collection, context: { ...context },
      data: upload.collection === 'media' ? { alt: 'New synthetic image' } : {},
      file: { data: body, mimetype: upload.mimeType, name: `new-${upload.filename}`, size: body.length }, depth: 0 })
    expect(storage.put).toHaveBeenCalledWith(payloadStorageKey(created, upload.prefix))
    await read(created)
    // The application disables clientUploads. Represent an already persisted
    // per-upload folder to test reads and replacements without enabling them.
    const objectKey = 'persisted-upload-folder'
    await client.query(`UPDATE ${upload.table} SET _objectkey=$1 WHERE id=$2`, [objectKey, created.id])
    storage.objects.set([upload.prefix, objectKey, created.filename].filter(Boolean).join('/'), { body, type: upload.mimeType })
    const keyed = await payload.findByID({ collection: upload.collection, id: created.id, depth: 0 })
    expect(keyed._objectKey).toBe(objectKey)
    await read(keyed)
    const replaced = await payload.update({ collection: upload.collection, id: created.id, context: { ...context }, data: {},
      file: { data: body, mimetype: upload.mimeType, name: `replacement-${upload.filename}`, size: body.length }, depth: 0 })
    expect(storage.put).toHaveBeenCalledWith(payloadStorageKey(replaced, upload.prefix))
    expect(storage.remove).toHaveBeenCalledWith(payloadStorageKey(keyed, upload.prefix))
    await read(replaced)
    await payload.delete({ collection: upload.collection, id: replaced.id, context: { ...context } })
    expect(storage.remove).toHaveBeenCalledWith(payloadStorageKey(replaced, upload.prefix))
    expect((await payload.findByID({ collection: upload.collection, id: legacy.id, depth: 0 })).filename).toBe(upload.filename)
    expect(storage.objects.has(payloadStorageKey(legacy, upload.prefix))).toBe(true)
  })
})
