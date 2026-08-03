import { getPayloadClient } from '@/lib/payload'
import { isGuid } from '@/lib/rock-forms/constants'

export async function isRockConnectionSignupPublished(blockGuid: string): Promise<boolean> {
  if (!isGuid(blockGuid)) return false
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'pages',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    select: { slug: true },
    where: {
      and: [
        { _status: { equals: 'published' } },
        { 'layout.blockType': { equals: 'formEmbed' } },
        { 'layout.sourceType': { equals: 'connectionOpportunity' } },
        { 'layout.rockConnectionBlockGuid': { equals: blockGuid.toLowerCase() } },
      ],
    },
  })
  return result.docs.length > 0
}
