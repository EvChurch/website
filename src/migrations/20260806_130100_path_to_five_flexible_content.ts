import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export const PATH_TO_FIVE_FLEXIBLE_CONTENT_UP_SQL = String.raw`
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_campuses_page_content_actions_variant') THEN
      CREATE TYPE "public"."enum_campuses_page_content_actions_variant" AS ENUM ('primary', 'secondary', 'text');
    END IF;
  END $$;

  ALTER TABLE "pages_blocks_form_embed"
    ADD COLUMN IF NOT EXISTS "fallback_contact_label" varchar DEFAULT 'Contact us another way',
    ADD COLUMN IF NOT EXISTS "fallback_contact_href" varchar DEFAULT '/contact';
  ALTER TABLE "_pages_v_blocks_form_embed"
    ADD COLUMN IF NOT EXISTS "fallback_contact_label" varchar DEFAULT 'Contact us another way',
    ADD COLUMN IF NOT EXISTS "fallback_contact_href" varchar DEFAULT '/contact';

  ALTER TABLE "pages_blocks_manual_card_grid_cards"
    ADD COLUMN IF NOT EXISTS "map_url" varchar;
  ALTER TABLE "_pages_v_blocks_manual_card_grid_cards"
    ADD COLUMN IF NOT EXISTS "map_url" varchar;

  UPDATE "pages_blocks_manual_card_grid_cards" cards
  SET
    "map_url" = cards."href",
    "href" = CASE lower(cards."title")
      WHEN 'north' THEN '/campus/north'
      WHEN 'central' THEN '/campus/central'
      WHEN 'unichurch' THEN '/campus/unichurch'
    END,
    "link_label" = CASE lower(cards."title")
      WHEN 'north' THEN 'Learn more about North Campus'
      WHEN 'central' THEN 'Learn more about Central Campus'
      WHEN 'unichurch' THEN 'Learn more about Unichurch'
    END
  FROM "pages_blocks_manual_card_grid" grid
  JOIN "pages" p ON p."id" = grid."_parent_id"
  WHERE cards."_parent_id" = grid."id"
    AND lower(p."slug") = 'contact'
    AND cards."link_label" = 'Open in Google Maps'
    AND lower(cards."title") IN ('north', 'central', 'unichurch');

  UPDATE "_pages_v_blocks_manual_card_grid_cards" cards
  SET
    "map_url" = cards."href",
    "href" = CASE lower(cards."title")
      WHEN 'north' THEN '/campus/north'
      WHEN 'central' THEN '/campus/central'
      WHEN 'unichurch' THEN '/campus/unichurch'
    END,
    "link_label" = CASE lower(cards."title")
      WHEN 'north' THEN 'Learn more about North Campus'
      WHEN 'central' THEN 'Learn more about Central Campus'
      WHEN 'unichurch' THEN 'Learn more about Unichurch'
    END
  FROM "_pages_v_blocks_manual_card_grid" grid
  JOIN "_pages_v" v ON v."id" = grid."_parent_id"
  WHERE cards."_parent_id" = grid."id"
    AND lower(v."version_slug") = 'contact'
    AND cards."link_label" = 'Open in Google Maps'
    AND lower(cards."title") IN ('north', 'central', 'unichurch');

  UPDATE "pages_blocks_form_embed" b
  SET
    "fallback_contact_label" = 'Message our welcome team',
    "fallback_contact_href" = '/contact'
  FROM "pages" p
  WHERE p."id" = b."_parent_id"
    AND lower(p."slug") = 'visit'
    AND lower(coalesce(b."rock_workflow_guid", '')) = 'de3d06a6-7fca-41a5-8c37-a485767de970';

  UPDATE "_pages_v_blocks_form_embed" b
  SET
    "fallback_contact_label" = 'Message our welcome team',
    "fallback_contact_href" = '/contact'
  FROM "_pages_v" v
  WHERE v."id" = b."_parent_id"
    AND lower(v."version_slug") = 'visit'
    AND lower(coalesce(b."rock_workflow_guid", '')) = 'de3d06a6-7fca-41a5-8c37-a485767de970';

  UPDATE "pages_blocks_cta" b
  SET "text" = 'No, no, and no. You''re our guest. Nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself.'
  FROM "pages" p
  WHERE p."id" = b."_parent_id"
    AND lower(p."slug") = 'visit'
    AND b."text" = 'No, no, and no. You''re our guest — nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself.';

  UPDATE "_pages_v_blocks_cta" b
  SET "text" = 'No, no, and no. You''re our guest. Nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself.'
  FROM "_pages_v" v
  WHERE v."id" = b."_parent_id"
    AND lower(v."version_slug") = 'visit'
    AND b."text" = 'No, no, and no. You''re our guest — nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself.';

  UPDATE "pages_blocks_hero" b
  SET "subtitle" = 'We''re one church family across three Auckland campuses, people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you''re at with God, there''s a seat here for you.'
  FROM "pages" p
  WHERE p."id" = b."_parent_id"
    AND lower(p."slug") = 'home'
    AND b."subtitle" = 'We''re one church family across three Auckland campuses — people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you''re at with God, there''s a seat here for you.';

  UPDATE "_pages_v_blocks_hero" b
  SET "subtitle" = 'We''re one church family across three Auckland campuses, people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you''re at with God, there''s a seat here for you.'
  FROM "_pages_v" v
  WHERE v."id" = b."_parent_id"
    AND lower(v."version_slug") = 'home'
    AND b."subtitle" = 'We''re one church family across three Auckland campuses — people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you''re at with God, there''s a seat here for you.';

  CREATE TABLE IF NOT EXISTS "campuses_page_content_actions" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "label" varchar NOT NULL,
    "href" varchar NOT NULL,
    "variant" "public"."enum_campuses_page_content_actions_variant" DEFAULT 'text',
    "external" boolean DEFAULT false
  );

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'campuses_page_content_actions_parent_id_fk'
    ) THEN
      ALTER TABLE "campuses_page_content_actions"
        ADD CONSTRAINT "campuses_page_content_actions_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."campuses"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS "campuses_page_content_actions_order_idx"
    ON "campuses_page_content_actions" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "campuses_page_content_actions_parent_id_idx"
    ON "campuses_page_content_actions" USING btree ("_parent_id");

  DELETE FROM "campuses_page_content_actions"
  WHERE "id" LIKE 'campus-%-action-message';

  UPDATE "campuses"
  SET "page_content_kids_ages" = 'Available for ages 0 to 12'
  WHERE "slug" IN ('central', 'north')
    AND "page_content_kids_ages" = 'Available for ages 1 to 12';

  INSERT INTO "campuses_page_content_actions"
    ("_order", "_parent_id", "id", "label", "href", "variant", "external")
  SELECT actions."action_order", campuses."id", ids."id", actions."label",
    CASE actions."kind"
      WHEN 'directions' THEN campuses."page_content_map_url"
      ELSE '/campus/' || campuses."slug" || '/calendar.ics'
    END,
    actions."variant"::"public"."enum_campuses_page_content_actions_variant",
    actions."kind" = 'directions'
  FROM "campuses"
  CROSS JOIN (VALUES
    (1, 'directions', 'Get directions', 'primary'),
    (2, 'calendar', 'Save service time', 'secondary')
  ) AS actions("action_order", "kind", "label", "variant")
  CROSS JOIN LATERAL (
    SELECT 'campus-' || campuses."slug" || '-action-' || actions."kind" AS "id"
  ) ids
  WHERE campuses."slug" IN ('central', 'north', 'unichurch')
    AND (actions."kind" <> 'directions' OR campuses."page_content_map_url" IS NOT NULL)
  ON CONFLICT ("id") DO NOTHING;
`

export const PATH_TO_FIVE_FLEXIBLE_CONTENT_DOWN_SQL = String.raw`
  UPDATE "pages_blocks_manual_card_grid_cards" cards
  SET
    "href" = cards."map_url",
    "link_label" = 'Open in Google Maps',
    "map_url" = NULL
  FROM "pages_blocks_manual_card_grid" grid
  JOIN "pages" p ON p."id" = grid."_parent_id"
  WHERE cards."_parent_id" = grid."id"
    AND lower(p."slug") = 'contact'
    AND cards."href" = '/campus/' || lower(cards."title")
    AND cards."map_url" IS NOT NULL;

  UPDATE "_pages_v_blocks_manual_card_grid_cards" cards
  SET
    "href" = cards."map_url",
    "link_label" = 'Open in Google Maps',
    "map_url" = NULL
  FROM "_pages_v_blocks_manual_card_grid" grid
  JOIN "_pages_v" v ON v."id" = grid."_parent_id"
  WHERE cards."_parent_id" = grid."id"
    AND lower(v."version_slug") = 'contact'
    AND cards."href" = '/campus/' || lower(cards."title")
    AND cards."map_url" IS NOT NULL;

  UPDATE "pages_blocks_cta" b
  SET "text" = 'No, no, and no. You''re our guest — nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself.'
  FROM "pages" p
  WHERE p."id" = b."_parent_id"
    AND lower(p."slug") = 'visit'
    AND b."text" = 'No, no, and no. You''re our guest. Nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself.';

  UPDATE "_pages_v_blocks_cta" b
  SET "text" = 'No, no, and no. You''re our guest — nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself.'
  FROM "_pages_v" v
  WHERE v."id" = b."_parent_id"
    AND lower(v."version_slug") = 'visit'
    AND b."text" = 'No, no, and no. You''re our guest. Nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself.';

  UPDATE "pages_blocks_hero" b
  SET "subtitle" = 'We''re one church family across three Auckland campuses — people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you''re at with God, there''s a seat here for you.'
  FROM "pages" p
  WHERE p."id" = b."_parent_id"
    AND lower(p."slug") = 'home'
    AND b."subtitle" = 'We''re one church family across three Auckland campuses, people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you''re at with God, there''s a seat here for you.';

  UPDATE "_pages_v_blocks_hero" b
  SET "subtitle" = 'We''re one church family across three Auckland campuses — people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you''re at with God, there''s a seat here for you.'
  FROM "_pages_v" v
  WHERE v."id" = b."_parent_id"
    AND lower(v."version_slug") = 'home'
    AND b."subtitle" = 'We''re one church family across three Auckland campuses, people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you''re at with God, there''s a seat here for you.';

  DELETE FROM "campuses_page_content_actions"
  WHERE "id" LIKE 'campus-%-action-%';
  DROP TABLE IF EXISTS "campuses_page_content_actions" CASCADE;

  ALTER TABLE "_pages_v_blocks_form_embed"
    DROP COLUMN IF EXISTS "fallback_contact_label",
    DROP COLUMN IF EXISTS "fallback_contact_href";
  ALTER TABLE "pages_blocks_form_embed"
    DROP COLUMN IF EXISTS "fallback_contact_label",
    DROP COLUMN IF EXISTS "fallback_contact_href";
  ALTER TABLE "_pages_v_blocks_manual_card_grid_cards"
    DROP COLUMN IF EXISTS "map_url";
  ALTER TABLE "pages_blocks_manual_card_grid_cards"
    DROP COLUMN IF EXISTS "map_url";
  DROP TYPE IF EXISTS "public"."enum_campuses_page_content_actions_variant";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(PATH_TO_FIVE_FLEXIBLE_CONTENT_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(PATH_TO_FIVE_FLEXIBLE_CONTENT_DOWN_SQL))
}
