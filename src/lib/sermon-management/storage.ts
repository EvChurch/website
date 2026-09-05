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
