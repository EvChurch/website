import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { copyFile, mkdir } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import type { Payload } from 'payload'

export async function copyWorkFile(
  payload: Payload,
  id: number,
  destination: string,
) {
  const file = await payload.findByID({
    collection: 'sermon-work-files',
    id,
    depth: 0,
  })
  if (!file.filename || path.basename(file.filename) !== file.filename)
    throw new Error('Audio file is missing.')
  await mkdir(path.dirname(destination), { recursive: true })
  if (process.env.S3_BUCKET) {
    const client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
    })
    const object = await client.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `sermon-work/${file.filename}`,
      }),
    )
    if (!object.Body) throw new Error('Audio file is missing from storage.')
    await pipeline(
      object.Body as import('node:stream').Readable,
      createWriteStream(destination),
    )
  } else {
    const config = payload.collections['sermon-work-files'].config.upload
    if (!config) throw new Error('Audio storage is unavailable.')
    await copyFile(path.resolve(config.staticDir!, file.filename), destination)
  }
  return file
}

/** Called only after the article worker or private review capability is authorized. */
export async function streamWorkFile(payload: Payload, id: number, range: string | null) {
  const file = await payload.findByID({ collection: 'sermon-work-files', id, depth: 0 })
  if (!file.filename || path.basename(file.filename) !== file.filename) throw new Error('Audio file is missing.')
  if (range && !/^bytes=\d+-\d*$/.test(range)) return new Response(null, { status: 416 })
  const headers: Record<string, string> = { 'Content-Type': file.mimeType || 'audio/mpeg', 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'bytes', 'Referrer-Policy': 'no-referrer' }
  if (process.env.S3_BUCKET) {
    const client = new S3Client({ region: process.env.S3_REGION || 'auto', ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}), credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' } })
    const object = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `sermon-work/${file.filename}`, ...(range ? { Range: range } : {}) }))
    if (!object.Body) throw new Error('Audio is missing.')
    if (object.ContentLength != null) headers['Content-Length'] = String(object.ContentLength)
    if (object.ContentRange) headers['Content-Range'] = object.ContentRange
    return new Response(object.Body.transformToWebStream(), { status: range ? 206 : 200, headers })
  }
  const { stat } = await import('node:fs/promises')
  const { createReadStream } = await import('node:fs')
  const { Readable } = await import('node:stream')
  const config = payload.collections['sermon-work-files'].config.upload
  if (!config) throw new Error('Audio storage unavailable.')
  const filename = path.resolve(config.staticDir!, file.filename)
  const { size } = await stat(filename)
  const match = range?.match(/^bytes=(\d+)-(\d*)$/)
  const start = match ? Number(match[1]) : 0
  const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size)
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
  headers['Content-Length'] = String(end - start + 1)
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`
  return new Response(Readable.toWeb(createReadStream(filename, { start, end })) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers })
}
