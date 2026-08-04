import { getPayloadClient } from '@/lib/payload'
import { isGuid } from '@/lib/rock-forms/constants'

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
  return result.docs.some((page) =>
    page.layout?.some(
      (block) =>
        block.blockType === 'formEmbed' &&
        block.sourceType === 'connectionOpportunity' &&
        block.rockConnectionBlockGuid?.toLowerCase() ===
          blockGuid.toLowerCase(),
    ),
  )
}
