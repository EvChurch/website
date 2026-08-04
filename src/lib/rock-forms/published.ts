import { getPayloadClient } from '@/lib/payload'

export async function isRockFormPublished(
  workflowTypeGuid: string,
): Promise<boolean> {
  const payload = await getPayloadClient()
  const normalizedGuid = workflowTypeGuid.toLowerCase()
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
        { 'layout.rockWorkflowGuid': { equals: normalizedGuid } },
      ],
    },
  })

  return result.docs.length > 0
}
