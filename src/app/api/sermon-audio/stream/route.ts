import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getPayloadClient } from '@/lib/payload'
import type { SermonAudio } from '@/payload-types'
import { open, stat } from 'node:fs/promises'
import path from 'node:path'

const SIGNED_URL_EXPIRES_IN = 43200 // 12 hours

function getS3Client() {
  return new S3Client({
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    region: process.env.S3_REGION || 'auto',
    ...(process.env.S3_ENDPOINT
      ? { endpoint: process.env.S3_ENDPOINT }
      : {}),
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filename = searchParams.get('file')

  if (!filename) {
    return new Response('Missing file parameter', { status: 400 })
  }

  // Verify the file exists in Payload
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'sermon-audio',
    where: { filename: { equals: filename } },
    limit: 1,
    depth: 0,
  })

  if (result.docs.length === 0) {
    return new Response('Not found', { status: 404 })
  }

  const doc = result.docs[0] as SermonAudio

  // S3 mode: redirect to signed URL
  if (process.env.S3_BUCKET) {
    const prefix = (doc as SermonAudio & { prefix?: string }).prefix
    const key = prefix ? `${prefix}/${doc.filename!}` : doc.filename!

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    })

    const signedUrl = await getSignedUrl(getS3Client(), command, {
      expiresIn: SIGNED_URL_EXPIRES_IN,
    })

    return Response.redirect(signedUrl, 302)
  }

  // Local mode: serve from Payload's upload directory with Range support
  const filePath = path.resolve('sermon-audio', doc.filename!)
  try {
    const fileStat = await stat(filePath)
    const size = fileStat.size
    const contentType = doc.mimeType || 'audio/mpeg'
    const rangeHeader = request.headers.get('range')

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? parseInt(match[2], 10) : size - 1
        const length = end - start + 1

        const fh = await open(filePath)
        const buffer = Buffer.alloc(length)
        await fh.read(buffer, 0, length, start)
        await fh.close()

        return new Response(buffer, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': length.toString(),
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Accept-Ranges': 'bytes',
          },
        })
      }
    }

    const fh = await open(filePath)
    const buffer = Buffer.alloc(size)
    await fh.read(buffer, 0, size, 0)
    await fh.close()

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': size.toString(),
        'Accept-Ranges': 'bytes',
      },
    })
  } catch {
    return new Response('File not found on disk', { status: 404 })
  }
}
