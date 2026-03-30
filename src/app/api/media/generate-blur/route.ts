import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getPayloadClient } from '@/lib/payload'
import sharp from 'sharp'

export const maxDuration = 300 // 5 minutes

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

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  const cronSecret = process.env.CRON_SECRET || ''
  if (!cronSecret || secret !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await getPayloadClient()
  const bucket = process.env.S3_BUCKET

  // Find images without blurDataURL
  const result = await payload.find({
    collection: 'media',
    where: {
      blurDataURL: { exists: false },
      mimeType: { contains: 'image/' },
    },
    limit: 50,
    depth: 0,
  })

  let processed = 0
  let skipped = 0
  const errors: string[] = []

  for (const doc of result.docs) {
    if (!doc.filename || doc.mimeType === 'image/svg+xml') {
      skipped++
      continue
    }

    try {
      let buffer: Buffer

      if (bucket) {
        // Fetch directly from S3
        const prefix = (doc as typeof doc & { prefix?: string }).prefix
        const key = prefix ? `${prefix}/${doc.filename}` : doc.filename
        const s3 = getS3Client()
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
        buffer = Buffer.from(await obj.Body!.transformToByteArray())
      } else {
        // Fallback: fetch via HTTP
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        const imageUrl = doc.url?.startsWith('http') ? doc.url : `${baseUrl}${doc.url}`
        const response = await fetch(imageUrl)
        if (!response.ok) {
          skipped++
          errors.push(`${doc.filename}: HTTP ${response.status}`)
          continue
        }
        buffer = Buffer.from(await response.arrayBuffer())
      }

      const blurBuffer = await sharp(buffer)
        .resize(10, 10, { fit: 'inside' })
        .blur(1)
        .png({ compressionLevel: 9 })
        .toBuffer()

      const blurDataURL = `data:image/png;base64,${blurBuffer.toString('base64')}`

      await payload.update({
        collection: 'media',
        id: doc.id,
        data: { blurDataURL },
        context: { skipBlurGeneration: true },
      })

      processed++
    } catch (err) {
      skipped++
      errors.push(`${doc.filename}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return Response.json({
    processed,
    skipped,
    remaining: result.totalDocs - result.docs.length,
    errors: errors.slice(0, 10),
  })
}
