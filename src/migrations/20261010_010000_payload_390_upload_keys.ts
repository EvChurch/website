import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// Both auth collections disable local passwords, so no reset-password field is
// generated. S3 adds _objectKey even when clientUploads is disabled. Leave old
// rows NULL: their objects remain at their existing prefix/filename paths.
export const PAYLOAD_390_UPLOAD_KEYS_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
ALTER TABLE media ADD COLUMN IF NOT EXISTS _objectkey varchar;
ALTER TABLE sermon_audio ADD COLUMN IF NOT EXISTS _objectkey varchar;
ALTER TABLE sermon_work_files ADD COLUMN IF NOT EXISTS _objectkey varchar;
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(PAYLOAD_390_UPLOAD_KEYS_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE media DROP COLUMN IF EXISTS _objectkey;
    ALTER TABLE sermon_audio DROP COLUMN IF EXISTS _objectkey;
    ALTER TABLE sermon_work_files DROP COLUMN IF EXISTS _objectkey;
  `)
}
