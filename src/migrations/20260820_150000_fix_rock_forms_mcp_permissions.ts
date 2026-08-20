import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const ROCK_FORMS_MCP_PERMISSION_FIELDS = [
  'rock_forms_find',
  'rock_forms_create',
  'rock_forms_update',
  'rock_forms_delete',
] as const

const addRockFormsMcpPermissions = ROCK_FORMS_MCP_PERMISSION_FIELDS.map(
  (field) => `  ADD COLUMN IF NOT EXISTS "${field}" boolean DEFAULT false`,
).join(',\n')

const dropRockFormsMcpPermissions = [...ROCK_FORMS_MCP_PERMISSION_FIELDS]
  .reverse()
  .map((field) => `  DROP COLUMN IF EXISTS "${field}"`)
  .join(',\n')

export const FIX_ROCK_FORMS_MCP_PERMISSIONS_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "payload_mcp_api_keys"
${addRockFormsMcpPermissions};
`

export const FIX_ROCK_FORMS_MCP_PERMISSIONS_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "payload_mcp_api_keys"
${dropRockFormsMcpPermissions};
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(FIX_ROCK_FORMS_MCP_PERMISSIONS_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(FIX_ROCK_FORMS_MCP_PERMISSIONS_DOWN_SQL))
}
