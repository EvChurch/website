import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_course_groups_status" AS ENUM('active', 'closed');
  CREATE TYPE "public"."enum_course_invitations_status" AS ENUM('pending', 'accepted', 'revoked');
  CREATE TYPE "public"."enum_course_invitations_delivery_status" AS ENUM('sending', 'sent', 'unknown');
  CREATE TYPE "public"."enum_course_attempts_membership_status" AS ENUM('active', 'left', 'removed');
  CREATE TABLE "course_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"edition_id" integer NOT NULL,
  	"facilitator_key" varchar NOT NULL,
  	"status" "enum_course_groups_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "course_invitations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"group_id" integer NOT NULL,
  	"email" varchar NOT NULL,
  	"inviter_key" varchar NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"status" "enum_course_invitations_status" DEFAULT 'pending' NOT NULL,
  	"delivery_status" "enum_course_invitations_delivery_status" DEFAULT 'sending' NOT NULL,
  	"provider_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "course_attempts" ADD COLUMN "group_id" integer;
  ALTER TABLE "course_attempts" ADD COLUMN "membership_status" "enum_course_attempts_membership_status" DEFAULT 'active' NOT NULL;
  ALTER TABLE "course_attempts" ADD COLUMN "display_name" varchar;
  ALTER TABLE "course_attempts" ADD COLUMN "account_email" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "course_groups_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "course_invitations_id" integer;
  ALTER TABLE "course_groups" ADD CONSTRAINT "course_groups_edition_id_course_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."course_editions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_invitations" ADD CONSTRAINT "course_invitations_group_id_course_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."course_groups"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "course_groups_edition_idx" ON "course_groups" USING btree ("edition_id");
  CREATE INDEX "course_groups_facilitator_key_idx" ON "course_groups" USING btree ("facilitator_key");
  CREATE INDEX "course_groups_updated_at_idx" ON "course_groups" USING btree ("updated_at");
  CREATE INDEX "course_groups_created_at_idx" ON "course_groups" USING btree ("created_at");
  CREATE INDEX "course_invitations_group_idx" ON "course_invitations" USING btree ("group_id");
  CREATE INDEX "course_invitations_email_idx" ON "course_invitations" USING btree ("email");
  CREATE INDEX "course_invitations_inviter_key_idx" ON "course_invitations" USING btree ("inviter_key");
  CREATE UNIQUE INDEX "course_invitations_token_hash_idx" ON "course_invitations" USING btree ("token_hash");
  CREATE INDEX "course_invitations_updated_at_idx" ON "course_invitations" USING btree ("updated_at");
  CREATE INDEX "course_invitations_created_at_idx" ON "course_invitations" USING btree ("created_at");
  ALTER TABLE "course_attempts" ADD CONSTRAINT "course_attempts_group_id_course_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."course_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_groups_fk" FOREIGN KEY ("course_groups_id") REFERENCES "public"."course_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_invitations_fk" FOREIGN KEY ("course_invitations_id") REFERENCES "public"."course_invitations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "course_attempts_group_idx" ON "course_attempts" USING btree ("group_id");
  CREATE UNIQUE INDEX "group_accountKey_idx" ON "course_attempts" USING btree ("group_id","account_key");
  CREATE INDEX "payload_locked_documents_rels_course_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("course_groups_id");
  CREATE INDEX "payload_locked_documents_rels_course_invitations_id_idx" ON "payload_locked_documents_rels" USING btree ("course_invitations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "course_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "course_invitations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "course_groups" CASCADE;
  DROP TABLE "course_invitations" CASCADE;
  ALTER TABLE "course_attempts" DROP CONSTRAINT IF EXISTS "course_attempts_group_id_course_groups_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_course_groups_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_course_invitations_fk";
  
  DROP INDEX "course_attempts_group_idx";
  DROP INDEX "group_accountKey_idx";
  DROP INDEX "payload_locked_documents_rels_course_groups_id_idx";
  DROP INDEX "payload_locked_documents_rels_course_invitations_id_idx";
  ALTER TABLE "course_attempts" DROP COLUMN "group_id";
  ALTER TABLE "course_attempts" DROP COLUMN "membership_status";
  ALTER TABLE "course_attempts" DROP COLUMN "display_name";
  ALTER TABLE "course_attempts" DROP COLUMN "account_email";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "course_groups_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "course_invitations_id";
  DROP TYPE "public"."enum_course_groups_status";
  DROP TYPE "public"."enum_course_invitations_status";
  DROP TYPE "public"."enum_course_invitations_delivery_status";
  DROP TYPE "public"."enum_course_attempts_membership_status";`)
}
