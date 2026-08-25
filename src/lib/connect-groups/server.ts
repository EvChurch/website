import { getPayloadClient } from '@/lib/payload'
import { isGuid } from '@/lib/rock-forms/constants'

export async function isActiveConnectGroupGuid(value: string): Promise<boolean> {
  if (!isGuid(value)) return false

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'connect-groups',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    select: { rockGroupId: true },
    where: {
      and: [
        { rockGroupGuid: { equals: value.toLowerCase() } },
        { isActive: { equals: true } },
      ],
    },
  })

  return result.docs.length === 1
}
