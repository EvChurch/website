import type { CollectionAfterChangeHook } from 'payload'
import sharp from 'sharp'

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
    // Build the full URL for the uploaded image
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const imageUrl = doc.url?.startsWith('http') ? doc.url : `${baseUrl}${doc.url}`

    const response = await fetch(imageUrl)
    if (!response.ok) return doc

    const buffer = Buffer.from(await response.arrayBuffer())

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
