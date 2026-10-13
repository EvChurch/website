import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "giving_funds" ADD COLUMN IF NOT EXISTS "student_minister_related" boolean DEFAULT false NOT NULL;
    CREATE INDEX IF NOT EXISTS "giving_funds_student_minister_related_idx" ON "giving_funds" USING btree ("student_minister_related");
    INSERT INTO giving_funds(name, code, accounting_key, active, is_default, apprentice_related, student_minister_related, sort_order)
    VALUES
      ('Henry Huang', 'HENRYHUANG', 'HENRYHUANG', true, false, false, true, 7),
      ('Jaron Heng', 'JARONHENG', 'JARONHENG', true, false, false, true, 8),
      ('Michael Gao', 'MICHAELGAO', 'MICHAELGAO', true, false, false, true, 9),
      ('Christine Knobbs', 'CKNOBBS', 'CKNOBBS', true, false, false, true, 10)
    ON CONFLICT (code) DO NOTHING;

  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "giving_funds_student_minister_related_idx";
    ALTER TABLE "giving_funds" DROP COLUMN IF EXISTS "student_minister_related";
  `)
}
