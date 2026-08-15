import type { CollectionAfterChangeHook } from 'payload'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

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

export const generateBlurPlaceholder: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
  context,
}) => {
  if (context?.skipBlurGeneration) return doc
  if (operation !== 'create' && operation !== 'update') return doc
  if (!doc.mimeType?.startsWith('image/')) return doc
  if (doc.mimeType === 'image/svg+xml') return doc
  if (doc.blurDataURL) return doc

  try {
    let buffer: Buffer
    const bucket = process.env.S3_BUCKET

    if (req.file?.data) {
      buffer = req.file.data
    } else if (bucket && doc.filename) {
      const prefix = doc.prefix as string | undefined
      const key = prefix ? `${prefix}/${doc.filename}` : doc.filename
      const s3 = getS3Client()
      const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      buffer = Buffer.from(await obj.Body!.transformToByteArray())
    } else {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const imageUrl = doc.url?.startsWith('http') ? doc.url : `${baseUrl}${doc.url}`
      const response = await fetch(imageUrl)
      if (!response.ok) return doc
      buffer = Buffer.from(await response.arrayBuffer())
    }

    const blurBuffer = await sharp(buffer)
      .resize(10, 10, { fit: 'inside' })
      .blur(1)
      .png({ compressionLevel: 9 })
      .toBuffer()

    const blurDataURL = `data:image/png;base64,${blurBuffer.toString('base64')}`

    await req.payload.update({
      collection: 'media',
      id: doc.id,
      data: { blurDataURL },
      context: { skipBlurGeneration: true },
    })

    return { ...doc, blurDataURL }
  } catch (error) {
    req.payload.logger.error({ msg: 'Failed to generate blur placeholder', error })
    return doc
  }
}
