import { sql } from '@payloadcms/db-postgres'
import { unstable_cache } from 'next/cache'
import type { Payload } from 'payload'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { getPayloadClient } from '@/lib/payload'
import {
  isEligiblePublicPath,
  isTrackableMissingPath,
  normalizePublicPath,
  parseInternalRedirectDestination,
} from '@/lib/public-paths'

async function queryMissingPathRedirect(path: string, client: Payload): Promise<string | null> {
  const { docs } = await client.find({
    collection: 'missing-paths',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    select: { destination: true },
    where: { path: { equals: path } },
  })
  const destination = docs[0]?.destination
  return typeof destination === 'string'
    ? parseInternalRedirectDestination(destination)
    : null
}

async function fetchMissingPathRedirect(path: string): Promise<string | null> {
  return queryMissingPathRedirect(path, await getPayloadClient())
}

const getCachedMissingPathRedirect = unstable_cache(
  fetchMissingPathRedirect,
  ['missing-path-redirect'],
  { tags: [CACHE_TAGS.missingPaths], revalidate: 86_400 },
)

export async function findMissingPathRedirect(
  input: string,
  payload?: Payload,
): Promise<string | null> {
  const path = normalizePublicPath(input)
  if (!path || !isEligiblePublicPath(path)) return null
  return payload
    ? queryMissingPathRedirect(path, payload)
    : getCachedMissingPathRedirect(path)
}

export type MissingPathRecordResult =
  | { recorded: true; path: string }
  | { recorded: false; reason: 'database'; path: string }
  | { recorded: false; reason: 'ineligible' }

export async function recordMissingPublicPath(
  input: string,
  payload?: Payload,
): Promise<MissingPathRecordResult> {
  const path = normalizePublicPath(input)
  if (!path || !isTrackableMissingPath(path)) {
    return { recorded: false, reason: 'ineligible' }
  }

  const client = payload ?? await getPayloadClient()
  try {
    await client.db.drizzle.execute(sql`
      INSERT INTO "missing_paths" ("path", "count", "updated_at", "created_at")
      VALUES (${path}, 1, now(), now())
      ON CONFLICT ("path") DO UPDATE
        SET "count" = "missing_paths"."count" + 1,
            "updated_at" = now()
      WHERE "missing_paths"."destination" IS NULL
    `)
    return { recorded: true, path }
  } catch {
    client.logger.error({
      category: 'missing-path-write-failed',
      path,
    })
    return { recorded: false, reason: 'database', path }
  }
}
