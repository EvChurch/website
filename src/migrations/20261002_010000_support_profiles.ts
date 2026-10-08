import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export const SUPPORT_PROFILES_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  CREATE TYPE enum_support_profiles_group AS ENUM ('apprentices','student-ministers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS support_profiles (
  id serial PRIMARY KEY,
  name varchar NOT NULL,
  slug varchar NOT NULL,
  "group" enum_support_profiles_group NOT NULL,
  photo_id integer REFERENCES media(id) ON DELETE SET NULL,
  blurb varchar,
  email varchar,
  published boolean NOT NULL DEFAULT false,
  sort_order numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS support_profiles_slug_idx ON support_profiles(slug);
CREATE INDEX IF NOT EXISTS support_profiles_photo_idx ON support_profiles(photo_id);
CREATE INDEX IF NOT EXISTS support_profiles_published_idx ON support_profiles(published);
ALTER TABLE giving_funds ADD COLUMN IF NOT EXISTS support_profile_id integer REFERENCES support_profiles(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS giving_funds_support_profile_idx ON giving_funds(support_profile_id);
ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS support_profiles_id integer REFERENCES support_profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_support_profiles_id_idx ON payload_locked_documents_rels(support_profiles_id);
ALTER TABLE payload_mcp_api_keys
  ADD COLUMN IF NOT EXISTS "support_profiles_find" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "support_profiles_create" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "support_profiles_update" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "support_profiles_delete" boolean DEFAULT false;

DO $$ BEGIN
  CREATE TYPE enum_pages_blocks_manual_card_grid_data_source AS ENUM ('manual','support-profiles');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE enum_pages_blocks_manual_card_grid_support_group AS ENUM ('apprentices','student-ministers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE enum__pages_v_blocks_manual_card_grid_data_source AS ENUM ('manual','support-profiles');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE enum__pages_v_blocks_manual_card_grid_support_group AS ENUM ('apprentices','student-ministers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE pages_blocks_manual_card_grid
  ADD COLUMN IF NOT EXISTS data_source enum_pages_blocks_manual_card_grid_data_source DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS support_group enum_pages_blocks_manual_card_grid_support_group;
ALTER TABLE _pages_v_blocks_manual_card_grid
  ADD COLUMN IF NOT EXISTS data_source enum__pages_v_blocks_manual_card_grid_data_source DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS support_group enum__pages_v_blocks_manual_card_grid_support_group;

ALTER TABLE giving_email_deliveries
  ADD COLUMN IF NOT EXISTS recipient_email varchar,
  ADD COLUMN IF NOT EXISTS recipient_name varchar;
ALTER TABLE giving_email_deliveries DROP CONSTRAINT IF EXISTS giving_email_deliveries_kind_check;
ALTER TABLE giving_email_deliveries ADD CONSTRAINT giving_email_deliveries_kind_check
  CHECK (kind IN ('bank-transfer-details','bank-transfer-thanks','blinkpay-thanks','blinkpay-support'));

-- Copy published About content once. Retain the original cards for historical page
-- versions; support-profile grids ignore these cards and hide them from editing.
INSERT INTO support_profiles(name,slug,"group",photo_id,blurb,email,published,sort_order)
SELECT card.title, trim(both '-' from regexp_replace(lower(card.title),'[^a-z0-9]+','-','g')),
  CASE WHEN lower(grid.description) = 'student ministers' THEN 'student-ministers' ELSE 'apprentices' END::enum_support_profiles_group,
  card.image_id, card.description,
  (SELECT detail.value FROM pages_blocks_manual_card_grid_cards_details detail
    WHERE detail._parent_id=card.id AND lower(detail.label)='email' ORDER BY detail._order LIMIT 1),
  page._status='published' AND card.image_id IS NOT NULL AND coalesce(trim(card.description),'')<>''
    AND EXISTS (SELECT 1 FROM pages_blocks_manual_card_grid_cards_details detail
      WHERE detail._parent_id=card.id AND lower(detail.label)='email' AND detail.value LIKE '%@%'),
  card._order
FROM pages_blocks_manual_card_grid_cards card
JOIN pages_blocks_manual_card_grid grid ON grid.id=card._parent_id
JOIN pages page ON page.id=grid._parent_id
WHERE page.slug='about' AND lower(grid.description) IN ('apprentices','student ministers')
ON CONFLICT(slug) DO NOTHING;

-- Missing profiles stay unpublished until their real photo, blurb and email are entered.
INSERT INTO support_profiles(name,slug,"group",sort_order)
SELECT name, trim(both '-' from regexp_replace(lower(name),'[^a-z0-9]+','-','g')),
  CASE WHEN student_minister_related THEN 'student-ministers' ELSE 'apprentices' END::enum_support_profiles_group,
  sort_order
FROM giving_funds WHERE (apprentice_related OR student_minister_related)
ON CONFLICT(slug) DO NOTHING;
UPDATE giving_funds fund SET support_profile_id=profile.id
FROM support_profiles profile
WHERE fund.support_profile_id IS NULL AND (fund.apprentice_related OR fund.student_minister_related)
  AND regexp_replace(lower(fund.name),'[^a-z0-9]','','g')=regexp_replace(lower(profile.name),'[^a-z0-9]','','g');

UPDATE pages_blocks_manual_card_grid grid SET data_source='support-profiles',
  support_group=CASE WHEN lower(grid.description)='student ministers' THEN 'student-ministers' ELSE 'apprentices' END::enum_pages_blocks_manual_card_grid_support_group
FROM pages page WHERE page.id=grid._parent_id AND page.slug='about' AND lower(grid.description) IN ('apprentices','student ministers')
  AND NOT EXISTS (
    SELECT 1 FROM pages_blocks_manual_card_grid_cards card
    LEFT JOIN support_profiles profile ON profile.slug=trim(both '-' from regexp_replace(lower(card.title),'[^a-z0-9]+','-','g'))
    WHERE card._parent_id=grid.id AND (profile.id IS NULL OR profile.published=false)
  );

-- Switch matching current editor content only; edited drafts and historical
-- snapshots retain their saved manual cards.
UPDATE _pages_v_blocks_manual_card_grid version_grid SET data_source='support-profiles',
  support_group=current_grid.support_group::text::enum__pages_v_blocks_manual_card_grid_support_group
FROM pages_blocks_manual_card_grid current_grid, _pages_v version
WHERE version_grid._uuid=current_grid.id AND current_grid.data_source='support-profiles'
  AND version.id=version_grid._parent_id AND version.latest=true
  AND (SELECT jsonb_agg(jsonb_build_array(to_jsonb(card)-'id'-'_parent_id'-'_uuid',
      (SELECT jsonb_agg(jsonb_build_array(detail.label,detail.value) ORDER BY detail._order)
        FROM _pages_v_blocks_manual_card_grid_cards_details detail WHERE detail._parent_id=card.id)
    ) ORDER BY card._order) FROM _pages_v_blocks_manual_card_grid_cards card WHERE card._parent_id=version_grid.id)
    IS NOT DISTINCT FROM
    (SELECT jsonb_agg(jsonb_build_array(to_jsonb(card)-'id'-'_parent_id'-'_uuid',
      (SELECT jsonb_agg(jsonb_build_array(detail.label,detail.value) ORDER BY detail._order)
        FROM pages_blocks_manual_card_grid_cards_details detail WHERE detail._parent_id=card.id)
    ) ORDER BY card._order) FROM pages_blocks_manual_card_grid_cards card WHERE card._parent_id=current_grid.id);

DO $$ DECLARE about_id integer; insertion_order integer; block_table record; BEGIN
  SELECT id INTO about_id FROM pages WHERE slug='about';
  IF about_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pages_blocks_manual_card_grid WHERE _parent_id=about_id
      AND (support_group='student-ministers' OR lower(description)='student ministers')
  ) THEN
    SELECT _order+1 INTO insertion_order FROM pages_blocks_manual_card_grid
      WHERE _parent_id=about_id AND (support_group='apprentices' OR lower(description)='apprentices') ORDER BY _order LIMIT 1;
    IF insertion_order IS NOT NULL THEN
      FOR block_table IN SELECT table_name FROM information_schema.columns
        WHERE table_schema='public' AND column_name='_path' AND table_name LIKE 'pages_blocks_%'
      LOOP
        EXECUTE format('UPDATE %I SET _order=_order+1 WHERE _parent_id=$1 AND _order >= $2',block_table.table_name)
          USING about_id,insertion_order;
      END LOOP;
      INSERT INTO pages_blocks_manual_card_grid(_order,_parent_id,_path,id,description,card_style,"columns",data_source,support_group)
      VALUES(insertion_order,about_id,'layout','support-student-ministers-about-'||about_id,'Student ministers','profile','3','support-profiles','student-ministers');
    END IF;
  END IF;
END $$;

-- Keep the editor's current version in step with the new student-minister section.
DO $$ DECLARE latest_version_id integer; student_grid record; block_table record; BEGIN
  FOR student_grid IN SELECT grid.* FROM pages_blocks_manual_card_grid grid
    JOIN pages page ON page.id=grid._parent_id WHERE page.slug='about' AND grid.id='support-student-ministers-about-'||page.id
  LOOP
    FOR latest_version_id IN SELECT id FROM _pages_v WHERE parent_id=student_grid._parent_id AND latest=true
    LOOP
      IF NOT EXISTS(SELECT 1 FROM _pages_v_blocks_manual_card_grid WHERE _parent_id=latest_version_id AND (support_group='student-ministers' OR lower(description)='student ministers')) THEN
        FOR block_table IN SELECT table_name FROM information_schema.columns
          WHERE table_schema='public' AND column_name='_path' AND table_name LIKE '\_pages\_v\_blocks\_%' ESCAPE '\'
        LOOP
          EXECUTE format('UPDATE %I SET _order=_order+1 WHERE _parent_id=$1 AND _order >= $2',block_table.table_name)
            USING latest_version_id,student_grid._order;
        END LOOP;
        INSERT INTO _pages_v_blocks_manual_card_grid(_order,_parent_id,_path,_uuid,description,card_style,"columns",data_source,support_group)
        VALUES(student_grid._order,latest_version_id,'layout',student_grid.id,'Student ministers','profile','3','support-profiles','student-ministers');
      END IF;
    END LOOP;
  END LOOP;
END $$;
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(SUPPORT_PROFILES_UP_SQL)) }

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`DO $$ BEGIN RAISE EXCEPTION 'Support profiles contain migrated church content. Roll back with a reviewed content-preserving migration.'; END $$;`)
}
