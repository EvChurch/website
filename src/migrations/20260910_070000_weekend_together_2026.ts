import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'
import {
  WEEKEND_TOGETHER_END,
  WEEKEND_TOGETHER_HEADING,
  WEEKEND_TOGETHER_PROGRAMME,
  WEEKEND_TOGETHER_START,
} from '../content/weekend-together-2026'

const programme = JSON.stringify(WEEKEND_TOGETHER_PROGRAMME).replaceAll("'", "''")

// Restrict the content update to the observed Rock identity and occurrence.
// Append to the existing introduction, retaining all other event fields.
export const WEEKEND_TOGETHER_UP_SQL = `
  UPDATE events SET
    start_date = '${WEEKEND_TOGETHER_START}'::timestamptz,
    end_date = '${WEEKEND_TOGETHER_END}'::timestamptz,
    summary = CASE WHEN summary::text LIKE '%${WEEKEND_TOGETHER_HEADING}%'
      THEN summary
      ELSE jsonb_set(
        COALESCE(summary, '{"root":{"type":"root","version":1,"format":"","indent":0,"direction":null,"children":[]}}'::jsonb),
        '{root,children}',
        COALESCE(summary #> '{root,children}', '[]'::jsonb) || '${programme}'::jsonb
      ) END,
    updated_at = now()
  WHERE rock_event_id = 40 AND slug = 'weekend-together'
    AND start_date = '${WEEKEND_TOGETHER_START}'::timestamptz
    AND (end_date IS DISTINCT FROM '${WEEKEND_TOGETHER_END}'::timestamptz
      OR summary IS NULL OR summary::text NOT LIKE '%${WEEKEND_TOGETHER_HEADING}%');
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(WEEKEND_TOGETHER_UP_SQL))
}

// Content rollback must not overwrite subsequent editor changes.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`SELECT 1`)
}
