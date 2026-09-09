import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

const WEEKEND_TOGETHER_START = '2026-11-06T06:00:00.000Z'
const WEEKEND_TOGETHER_HEADING = 'Weekend Together programme — 6–8 November 2026'

function textNode(text: string) {
  return { type: 'text', version: 1, text, format: 0, style: '', mode: 'normal', detail: 0 }
}

function block(type: 'heading' | 'paragraph', text: string, tag?: 'h2' | 'h3') {
  return {
    type,
    version: 1,
    format: '',
    indent: 0,
    direction: null,
    ...(tag ? { tag } : {}),
    children: [textNode(text)],
  }
}

const programme = JSON.stringify([
  block('heading', WEEKEND_TOGETHER_HEADING, 'h2'),
  block('heading', 'Friday 6 November', 'h3'),
  block('paragraph', '7:00 pm — Arrival & Dessert'),
  block('paragraph', '8:00 pm — Session One'),
  block('paragraph', '9:15 pm — Board Games and chats'),
  block('heading', 'Saturday 7 November', 'h3'),
  block('paragraph', '8:30 am — Arrive — Coffee & Bagels'),
  block('paragraph', '9:15 am — Session Two'),
  block('paragraph', '10:30 am — Morning Tea'),
  block('paragraph', '11:00 am — Session Three'),
  block('paragraph', '12:30 pm — Lunch'),
  block('paragraph', '1:30 pm — Afternoon Activity'),
  block('paragraph', '3:00 pm — Free Time / Afternoon Tea'),
  block('paragraph', '3:45 pm — Optional organised Sports'),
  block('paragraph', '5:30 pm — Dinner'),
  block('paragraph', "6:30 pm — Kids' Games"),
  block('paragraph', '7:30 pm — Evening Programme'),
  block('paragraph', '9:30 pm — End'),
  block('heading', 'Sunday 8 November', 'h3'),
  block('paragraph', '9:30 am — Arrive — Coffee'),
  block('paragraph', '10:15 am — Church Service (regular service time)'),
  block('paragraph', 'Post-service — Lunch together'),
  block('paragraph', '3:00 pm — End — Clean up complete'),
]).replaceAll("'", "''")

// Add a reusable, editor-owned summary, then seed this occurrence through that
// interface. Rock continues to own dates and source copy; future syncs do not
// touch the website summary.
export const WEEKEND_TOGETHER_UP_SQL = `
  ALTER TABLE events
    ADD COLUMN IF NOT EXISTS website_summary jsonb;

  UPDATE events SET
    website_summary = CASE
      WHEN COALESCE(website_summary, summary)::text LIKE '%${WEEKEND_TOGETHER_HEADING}%'
        THEN COALESCE(website_summary, summary)
      ELSE jsonb_set(
        COALESCE(
          website_summary,
          summary,
          '{"root":{"type":"root","version":1,"format":"","indent":0,"direction":null,"children":[]}}'::jsonb
        ),
        '{root,children}',
        COALESCE(website_summary #> '{root,children}', summary #> '{root,children}', '[]'::jsonb)
          || '${programme}'::jsonb
      )
    END,
    updated_at = now()
  WHERE rock_event_id = 40 AND slug = 'weekend-together'
    AND start_date = '${WEEKEND_TOGETHER_START}'::timestamptz
    AND (
      website_summary IS NULL
      OR website_summary::text NOT LIKE '%${WEEKEND_TOGETHER_HEADING}%'
    );
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(WEEKEND_TOGETHER_UP_SQL))
}

// Keep editor-owned content during rollback; older application versions ignore
// these additive columns, and a later forward migration can reuse the data.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`SELECT 1`)
}
