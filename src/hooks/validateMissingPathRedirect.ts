import { sql } from '@payloadcms/db-postgres'
import { APIError, type CollectionBeforeChangeHook, type Where } from 'payload'

import { normalizePublicPath, parseInternalRedirectDestination } from '@/lib/public-paths'

interface MissingPathDocument {
  id: number | string
  path: string
  count: number
  destination?: string | null
}

const missingPathRedirectLockKey = 1_061_020_404

function invalidRedirect(message: string) {
  return new APIError(message, 400)
}

async function lockRedirectGraph(
  req: Parameters<CollectionBeforeChangeHook>[0]['req'],
) {
  const transactionID = await req.transactionID
  const session = transactionID === undefined
    ? undefined
    : req.payload.db.sessions?.[transactionID]
  if (!session) {
    throw new APIError('Missing-path redirect validation is unavailable.', 503)
  }

  const transaction = session.db as {
    execute(query: ReturnType<typeof sql>): Promise<unknown>
  }
  await transaction.execute(sql`SELECT pg_advisory_xact_lock(${missingPathRedirectLockKey})`)
}

export const validateMissingPathRedirect: CollectionBeforeChangeHook<MissingPathDocument> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  await lockRedirectGraph(req)

  const sourceInput = data.path ?? originalDoc?.path
  const source = typeof sourceInput === 'string' ? normalizePublicPath(sourceInput) : null
  if (!source) throw invalidRedirect('Enter a valid root-relative missing path.')

  const destinationInput = data.destination
  const clearsDestination = destinationInput === null || destinationInput === ''
  const existingDestination = operation === 'update' ? originalDoc?.destination : undefined
  const effectiveDestination = destinationInput === undefined ? existingDestination : destinationInput
  const destination = clearsDestination || effectiveDestination == null
    ? null
    : typeof effectiveDestination === 'string'
      ? parseInternalRedirectDestination(effectiveDestination)
      : null

  if (effectiveDestination != null && !clearsDestination && !destination) {
    throw invalidRedirect('Redirect destination must be a root-relative path without a query or fragment.')
  }
  if (destination === source) {
    throw invalidRedirect('Redirect destination cannot match the missing path.')
  }

  if (destination) {
    const destinationAsSourceWhere: Where = originalDoc?.id
      ? {
          and: [
            { path: { equals: destination } },
            { id: { not_equals: originalDoc.id } },
          ],
        }
      : { path: { equals: destination } }

    const { docs: activeSources } = await req.payload.find({
      collection: 'missing-paths',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      req,
      select: { destination: true },
      where: destinationAsSourceWhere,
    })

    const activeDestination = activeSources[0]?.destination
    if (typeof activeDestination === 'string' && activeDestination.length > 0) {
      throw invalidRedirect('Redirect destination is already configured as a redirect source.')
    }

    const sourceAsDestinationWhere: Where = originalDoc?.id
      ? {
          and: [
            { destination: { equals: source } },
            { id: { not_equals: originalDoc.id } },
          ],
        }
      : { destination: { equals: source } }

    const { docs: reverseEdges } = await req.payload.find({
      collection: 'missing-paths',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      req,
      select: { destination: true },
      where: sourceAsDestinationWhere,
    })

    if (reverseEdges.length > 0) {
      throw invalidRedirect('Missing path is already configured as a redirect destination.')
    }
  }

  return {
    ...data,
    path: source,
    ...(destinationInput !== undefined ? { destination } : {}),
  }
}
