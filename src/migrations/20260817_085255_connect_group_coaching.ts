import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const CONNECT_GROUP_COACHING_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE "connect_group_participants_coached_groups" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "rock_group_id" numeric NOT NULL
);

ALTER TABLE "connect_group_participants_coached_groups"
  ADD CONSTRAINT "connect_group_participants_coached_groups_parent_id_fk"
  FOREIGN KEY ("_parent_id") REFERENCES "public"."connect_group_participants"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX "connect_group_participants_coached_groups_order_idx"
  ON "connect_group_participants_coached_groups" USING btree ("_order");
CREATE INDEX "connect_group_participants_coached_groups_parent_id_idx"
  ON "connect_group_participants_coached_groups" USING btree ("_parent_id");
CREATE INDEX "connect_group_participants_coached_groups_rock_group_id_idx"
  ON "connect_group_participants_coached_groups" USING btree ("rock_group_id");
`

export const CONNECT_GROUP_COACHING_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE IF EXISTS "connect_group_participants_coached_groups" CASCADE;
`

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql.raw(CONNECT_GROUP_COACHING_UP_SQL))
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql.raw(CONNECT_GROUP_COACHING_DOWN_SQL))
}
