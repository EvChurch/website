import { getPayloadClient } from '@/lib/payload'
import sharp from 'sharp'

export const maxDuration = 300 // 5 minutes

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  const cronSecret = process.env.CRON_SECRET || ''
  if (!cronSecret || secret !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await getPayloadClient()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

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

  for (const doc of result.docs) {
    if (!doc.url || doc.mimeType === 'image/svg+xml') {
      skipped++
      continue
    }

    try {
      const imageUrl = doc.url.startsWith('http') ? doc.url : `${baseUrl}${doc.url}`
      const response = await fetch(imageUrl)
      if (!response.ok) {
        skipped++
        continue
      }

      const buffer = Buffer.from(await response.arrayBuffer())
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
    } catch {
      skipped++
    }
  }

  return Response.json({
    processed,
    skipped,
    remaining: result.totalDocs - result.docs.length,
  })
}
