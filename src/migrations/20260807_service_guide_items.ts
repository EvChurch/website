import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "service_guide_items_campus_guids" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "guid" varchar NOT NULL
    );

    CREATE TABLE "service_guide_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "rock_id" numeric NOT NULL,
      "rock_guid" varchar,
      "title" varchar NOT NULL,
      "content" varchar,
      "promotional_blurb" varchar,
      "banner_image_guid" varchar,
      "status" numeric NOT NULL,
      "start_date_time" timestamp(3) with time zone,
      "expire_date_time" timestamp(3) with time zone,
      "priority" numeric DEFAULT 0 NOT NULL,
      "source_order" numeric DEFAULT 0 NOT NULL,
      "direct_link" varchar,
      "workflow_guid" varchar,
      "connection_opportunity_guid" varchar,
      "connection_block_guid" varchar,
      "event_guid" varchar,
      "event_id" integer,
      "last_synced_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "service_guide_items_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "campuses_id" integer
    );

    CREATE TABLE "service_guide_sync_state" (
      "id" serial PRIMARY KEY NOT NULL,
      "last_successful_sync_at" timestamp(3) with time zone,
      "item_count" numeric DEFAULT 0 NOT NULL,
      "diagnostic_count" numeric DEFAULT 0 NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "service_guide_items_campus_guids"
      ADD CONSTRAINT "service_guide_items_campus_guids_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."service_guide_items"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "service_guide_items"
      ADD CONSTRAINT "service_guide_items_event_id_events_id_fk"
      FOREIGN KEY ("event_id") REFERENCES "public"."events"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "service_guide_items_rels"
      ADD CONSTRAINT "service_guide_items_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."service_guide_items"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "service_guide_items_rels"
      ADD CONSTRAINT "service_guide_items_rels_campuses_fk"
      FOREIGN KEY ("campuses_id") REFERENCES "public"."campuses"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "service_guide_items_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_service_guide_items_fk"
      FOREIGN KEY ("service_guide_items_id") REFERENCES "public"."service_guide_items"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE UNIQUE INDEX "service_guide_items_rock_id_idx" ON "service_guide_items" USING btree ("rock_id");
    CREATE INDEX "service_guide_items_status_idx" ON "service_guide_items" USING btree ("status");
    CREATE INDEX "service_guide_items_start_date_time_idx" ON "service_guide_items" USING btree ("start_date_time");
    CREATE INDEX "service_guide_items_expire_date_time_idx" ON "service_guide_items" USING btree ("expire_date_time");
    CREATE INDEX "service_guide_items_priority_idx" ON "service_guide_items" USING btree ("priority");
    CREATE INDEX "service_guide_items_source_order_idx" ON "service_guide_items" USING btree ("source_order");
    CREATE INDEX "service_guide_items_workflow_guid_idx" ON "service_guide_items" USING btree ("workflow_guid");
    CREATE INDEX "service_guide_items_connection_opportunity_guid_idx" ON "service_guide_items" USING btree ("connection_opportunity_guid");
    CREATE INDEX "service_guide_items_connection_block_guid_idx" ON "service_guide_items" USING btree ("connection_block_guid");
    CREATE INDEX "service_guide_items_event_guid_idx" ON "service_guide_items" USING btree ("event_guid");
    CREATE INDEX "service_guide_items_event_idx" ON "service_guide_items" USING btree ("event_id");
    CREATE INDEX "service_guide_items_updated_at_idx" ON "service_guide_items" USING btree ("updated_at");
    CREATE INDEX "service_guide_items_created_at_idx" ON "service_guide_items" USING btree ("created_at");
    CREATE INDEX "service_guide_items_campus_guids_order_idx" ON "service_guide_items_campus_guids" USING btree ("_order");
    CREATE INDEX "service_guide_items_campus_guids_parent_id_idx" ON "service_guide_items_campus_guids" USING btree ("_parent_id");
    CREATE INDEX "service_guide_items_rels_order_idx" ON "service_guide_items_rels" USING btree ("order");
    CREATE INDEX "service_guide_items_rels_parent_idx" ON "service_guide_items_rels" USING btree ("parent_id");
    CREATE INDEX "service_guide_items_rels_path_idx" ON "service_guide_items_rels" USING btree ("path");
    CREATE INDEX "service_guide_items_rels_campuses_id_idx" ON "service_guide_items_rels" USING btree ("campuses_id");
    CREATE INDEX "service_guide_sync_state_updated_at_idx" ON "service_guide_sync_state" USING btree ("updated_at");
    CREATE INDEX "service_guide_sync_state_created_at_idx" ON "service_guide_sync_state" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_service_guide_items_id_idx"
      ON "payload_locked_documents_rels" USING btree ("service_guide_items_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_service_guide_items_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_service_guide_items_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "service_guide_items_id";
    DROP TABLE IF EXISTS "service_guide_items_rels" CASCADE;
    DROP TABLE IF EXISTS "service_guide_items_campus_guids" CASCADE;
    DROP TABLE IF EXISTS "service_guide_items" CASCADE;
    DROP TABLE IF EXISTS "service_guide_sync_state" CASCADE;
  `)
}
