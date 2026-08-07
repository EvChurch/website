import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const MEMBERS_ROCK_SYNC_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE "connect_group_participants" (
  "id" serial PRIMARY KEY NOT NULL,
  "rock_person_id" numeric NOT NULL,
  "name" varchar NOT NULL,
  "email" varchar,
  "photo_id" numeric,
  "is_coach" boolean DEFAULT false NOT NULL,
  "last_synced_at" timestamp(3) with time zone NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "connect_group_participants_phone_numbers" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "number" varchar NOT NULL,
  "type_value_id" numeric,
  "is_messaging_enabled" boolean DEFAULT false NOT NULL
);

CREATE TABLE "connect_group_participants_memberships" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "rock_group_id" numeric NOT NULL,
  "rock_membership_id" numeric NOT NULL,
  "rock_role_id" numeric NOT NULL,
  "role_name" varchar NOT NULL,
  "is_leader" boolean DEFAULT false NOT NULL
);

CREATE TABLE "connect_group_leader_resources" (
  "id" serial PRIMARY KEY NOT NULL,
  "rock_id" numeric NOT NULL,
  "rock_guid" varchar,
  "title" varchar NOT NULL,
  "status" numeric NOT NULL,
  "start_date_time" timestamp(3) with time zone,
  "expire_date_time" timestamp(3) with time zone,
  "youtube_url" varchar,
  "promotional_image_guid" varchar,
  "description" varchar,
  "bible_reference" varchar,
  "leader_notes_file_guid" varchar,
  "leader_notes_file_name" varchar,
  "member_study_file_guid" varchar,
  "member_study_file_name" varchar,
  "priority" numeric DEFAULT 0 NOT NULL,
  "source_order" numeric DEFAULT 0 NOT NULL,
  "last_synced_at" timestamp(3) with time zone NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "connect_group_leader_resources_campus_guids" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "guid" varchar NOT NULL
);

CREATE TABLE "connect_group_leader_resources_hosts" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "person_alias_guid" varchar,
  "name" varchar NOT NULL,
  "photo_id" numeric
);

CREATE TABLE "connect_group_leader_resources_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "campuses_id" integer
);

ALTER TABLE "connect_group_participants_phone_numbers"
  ADD CONSTRAINT "connect_group_participants_phone_numbers_parent_id_fk"
  FOREIGN KEY ("_parent_id") REFERENCES "public"."connect_group_participants"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "connect_group_participants_memberships"
  ADD CONSTRAINT "connect_group_participants_memberships_parent_id_fk"
  FOREIGN KEY ("_parent_id") REFERENCES "public"."connect_group_participants"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "connect_group_leader_resources_campus_guids"
  ADD CONSTRAINT "connect_group_leader_resources_campus_guids_parent_id_fk"
  FOREIGN KEY ("_parent_id") REFERENCES "public"."connect_group_leader_resources"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "connect_group_leader_resources_hosts"
  ADD CONSTRAINT "connect_group_leader_resources_hosts_parent_id_fk"
  FOREIGN KEY ("_parent_id") REFERENCES "public"."connect_group_leader_resources"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "connect_group_leader_resources_rels"
  ADD CONSTRAINT "connect_group_leader_resources_rels_parent_fk"
  FOREIGN KEY ("parent_id") REFERENCES "public"."connect_group_leader_resources"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "connect_group_leader_resources_rels"
  ADD CONSTRAINT "connect_group_leader_resources_rels_campuses_fk"
  FOREIGN KEY ("campuses_id") REFERENCES "public"."campuses"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels"
  ADD COLUMN "connect_group_participants_id" integer,
  ADD COLUMN "connect_group_leader_resources_id" integer;
ALTER TABLE "payload_locked_documents_rels"
  ADD CONSTRAINT "payload_locked_documents_rels_connect_group_participants_fk"
  FOREIGN KEY ("connect_group_participants_id") REFERENCES "public"."connect_group_participants"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payload_locked_documents_rels"
  ADD CONSTRAINT "payload_locked_documents_rels_connect_group_leader_resources_fk"
  FOREIGN KEY ("connect_group_leader_resources_id") REFERENCES "public"."connect_group_leader_resources"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "connect_group_participants_rock_person_id_idx"
  ON "connect_group_participants" USING btree ("rock_person_id");
CREATE INDEX "connect_group_participants_name_idx"
  ON "connect_group_participants" USING btree ("name");
CREATE INDEX "connect_group_participants_email_idx"
  ON "connect_group_participants" USING btree ("email");
CREATE INDEX "connect_group_participants_photo_id_idx"
  ON "connect_group_participants" USING btree ("photo_id");
CREATE INDEX "connect_group_participants_is_coach_idx"
  ON "connect_group_participants" USING btree ("is_coach");
CREATE INDEX "connect_group_participants_updated_at_idx"
  ON "connect_group_participants" USING btree ("updated_at");
CREATE INDEX "connect_group_participants_created_at_idx"
  ON "connect_group_participants" USING btree ("created_at");
CREATE INDEX "connect_group_participants_phone_numbers_order_idx"
  ON "connect_group_participants_phone_numbers" USING btree ("_order");
CREATE INDEX "connect_group_participants_phone_numbers_parent_id_idx"
  ON "connect_group_participants_phone_numbers" USING btree ("_parent_id");
CREATE INDEX "connect_group_participants_memberships_order_idx"
  ON "connect_group_participants_memberships" USING btree ("_order");
CREATE INDEX "connect_group_participants_memberships_parent_id_idx"
  ON "connect_group_participants_memberships" USING btree ("_parent_id");
CREATE INDEX "connect_group_participants_memberships_rock_group_id_idx"
  ON "connect_group_participants_memberships" USING btree ("rock_group_id");
CREATE UNIQUE INDEX "connect_group_participants_memberships_rock_membership_id_idx"
  ON "connect_group_participants_memberships" USING btree ("rock_membership_id");

CREATE UNIQUE INDEX "connect_group_leader_resources_rock_id_idx"
  ON "connect_group_leader_resources" USING btree ("rock_id");
CREATE INDEX "connect_group_leader_resources_rock_guid_idx"
  ON "connect_group_leader_resources" USING btree ("rock_guid");
CREATE INDEX "connect_group_leader_resources_status_idx"
  ON "connect_group_leader_resources" USING btree ("status");
CREATE INDEX "connect_group_leader_resources_start_date_time_idx"
  ON "connect_group_leader_resources" USING btree ("start_date_time");
CREATE INDEX "connect_group_leader_resources_expire_date_time_idx"
  ON "connect_group_leader_resources" USING btree ("expire_date_time");
CREATE INDEX "connect_group_leader_resources_priority_idx"
  ON "connect_group_leader_resources" USING btree ("priority");
CREATE INDEX "connect_group_leader_resources_source_order_idx"
  ON "connect_group_leader_resources" USING btree ("source_order");
CREATE INDEX "connect_group_leader_resources_updated_at_idx"
  ON "connect_group_leader_resources" USING btree ("updated_at");
CREATE INDEX "connect_group_leader_resources_created_at_idx"
  ON "connect_group_leader_resources" USING btree ("created_at");
CREATE INDEX "connect_group_leader_resources_campus_guids_order_idx"
  ON "connect_group_leader_resources_campus_guids" USING btree ("_order");
CREATE INDEX "connect_group_leader_resources_campus_guids_parent_id_idx"
  ON "connect_group_leader_resources_campus_guids" USING btree ("_parent_id");
CREATE INDEX "connect_group_leader_resources_hosts_order_idx"
  ON "connect_group_leader_resources_hosts" USING btree ("_order");
CREATE INDEX "connect_group_leader_resources_hosts_parent_id_idx"
  ON "connect_group_leader_resources_hosts" USING btree ("_parent_id");
CREATE INDEX "connect_group_leader_resources_rels_order_idx"
  ON "connect_group_leader_resources_rels" USING btree ("order");
CREATE INDEX "connect_group_leader_resources_rels_parent_idx"
  ON "connect_group_leader_resources_rels" USING btree ("parent_id");
CREATE INDEX "connect_group_leader_resources_rels_path_idx"
  ON "connect_group_leader_resources_rels" USING btree ("path");
CREATE INDEX "connect_group_leader_resources_rels_campuses_id_idx"
  ON "connect_group_leader_resources_rels" USING btree ("campuses_id");
CREATE INDEX "payload_locked_documents_rels_connect_group_participants_id_idx"
  ON "payload_locked_documents_rels" USING btree ("connect_group_participants_id");
CREATE INDEX "payload_locked_documents_rels_connect_group_leader_resources_id_idx"
  ON "payload_locked_documents_rels" USING btree ("connect_group_leader_resources_id");
`

export const MEMBERS_ROCK_SYNC_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "payload_locked_documents_rels"
  DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_connect_group_participants_fk",
  DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_connect_group_leader_resources_fk";
DROP INDEX IF EXISTS "payload_locked_documents_rels_connect_group_participants_id_idx";
DROP INDEX IF EXISTS "payload_locked_documents_rels_connect_group_leader_resources_id_idx";
ALTER TABLE "payload_locked_documents_rels"
  DROP COLUMN IF EXISTS "connect_group_participants_id",
  DROP COLUMN IF EXISTS "connect_group_leader_resources_id";

DROP TABLE IF EXISTS "connect_group_leader_resources_rels" CASCADE;
DROP TABLE IF EXISTS "connect_group_leader_resources_hosts" CASCADE;
DROP TABLE IF EXISTS "connect_group_leader_resources_campus_guids" CASCADE;
DROP TABLE IF EXISTS "connect_group_leader_resources" CASCADE;
DROP TABLE IF EXISTS "connect_group_participants_memberships" CASCADE;
DROP TABLE IF EXISTS "connect_group_participants_phone_numbers" CASCADE;
DROP TABLE IF EXISTS "connect_group_participants" CASCADE;
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(MEMBERS_ROCK_SYNC_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(MEMBERS_ROCK_SYNC_DOWN_SQL))
}
