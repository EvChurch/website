import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { getPayloadClient } from '@/lib/payload'
import {
  isEligiblePublicPath,
  normalizePublicPath,
  parseInternalRedirectDestination,
} from '@/lib/public-paths'

export async function findMissingPathRedirect(
  input: string,
  payload?: Payload,
): Promise<string | null> {
  const path = normalizePublicPath(input)
  if (!path || !isEligiblePublicPath(path)) return null
  const client = payload ?? await getPayloadClient()
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

export type MissingPathRecordResult =
  | { recorded: true; path: string }
  | { recorded: false; reason: 'database'; path: string }
  | { recorded: false; reason: 'ineligible' }

export async function recordMissingPublicPath(
  input: string,
  payload?: Payload,
): Promise<MissingPathRecordResult> {
  const path = normalizePublicPath(input)
  if (!path || !isEligiblePublicPath(path)) {
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
