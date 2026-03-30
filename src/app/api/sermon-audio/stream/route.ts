import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getPayloadClient } from '@/lib/payload'
import type { SermonAudio } from '@/payload-types'

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

  if (!process.env.S3_BUCKET) {
    return new Response('Storage not configured', { status: 503 })
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
  const key = `sermon-audio/${doc.filename}`

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  })

  const signedUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: SIGNED_URL_EXPIRES_IN,
  })

  return Response.redirect(signedUrl, 302)
}
