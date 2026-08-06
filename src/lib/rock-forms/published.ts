import { getPayloadClient } from '@/lib/payload'
import { FIXED_LAUNCHER_WORKFLOW_GUIDS } from '@/lib/launcher/constants'
import { isPublishedLauncherWorkflow } from '@/lib/launcher/service-guide'
import { isGuid } from './constants'

export async function isRockFormPublished(
  workflowTypeGuid: string,
): Promise<boolean> {
  if (!isGuid(workflowTypeGuid)) return false
  const normalizedGuid = workflowTypeGuid.toLowerCase()
  if (FIXED_LAUNCHER_WORKFLOW_GUIDS.has(normalizedGuid)) return true
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
        { 'layout.rockWorkflowGuid': { equals: normalizedGuid } },
      ],
    },
  })

  if (result.docs.length > 0) return true

  try {
    return await isPublishedLauncherWorkflow(normalizedGuid)
  } catch {
    return false
  }
}
