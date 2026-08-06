import { getPayloadClient } from '@/lib/payload'
import { isPublishedLauncherConnection } from '@/lib/launcher/service-guide'
import { isGuid } from '@/lib/rock-forms/constants'

interface PublishedPage {
  layout?: Array<{
    blockType?: string | null
    sourceType?: string | null
    rockConnectionBlockGuid?: string | null
  }> | null
}

export async function isRockConnectionSignupPublished(
  blockGuid: string,
): Promise<boolean> {
  if (!isGuid(blockGuid)) return false
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'pages',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    select: { layout: true },
    where: {
      and: [
        { _status: { equals: 'published' } },
        {
          'layout.rockConnectionBlockGuid': { equals: blockGuid.toLowerCase() },
        },
      ],
    },
  })
  const pages = result.docs as unknown as PublishedPage[]
  const publishedOnPage = pages.some((page) =>
    page.layout?.some(
      (block) =>
        block.blockType === 'formEmbed' &&
        block.sourceType === 'connectionOpportunity' &&
        block.rockConnectionBlockGuid?.toLowerCase() ===
          blockGuid.toLowerCase(),
    ),
  )
  if (publishedOnPage) return true

  try {
    return await isPublishedLauncherConnection(blockGuid)
  } catch {
    return false
  }
}
