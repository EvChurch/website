import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

function ageCopySql(fromMinimum: '0' | '1', toMinimum: '0' | '1'): string {
  const fromAge = `${fromMinimum} to 12`
  const toAge = `${toMinimum} to 12`
  const fromRange = fromAge.replaceAll(' to ', '-')
  const toRange = toAge.replaceAll(' to ', '-')
  const fromCrecheAge = `${fromMinimum} to 2`
  const toCrecheAge = `${toMinimum} to 2`
  const fromCrecheRange = `${fromMinimum}-2`
  const toCrecheRange = `${toMinimum}-2`

  return String.raw`
    UPDATE "campuses"
    SET "page_content_kids_ages" = replace("page_content_kids_ages", '${fromAge}', '${toAge}')
    WHERE "slug" IN ('central', 'north')
      AND "page_content_kids_ages" LIKE '%' || '${fromAge}' || '%';

    UPDATE "pages" SET
      "seo_meta_title" = replace("seo_meta_title", '${fromRange}', '${toRange}'),
      "seo_meta_description" = replace("seo_meta_description", '${fromRange}', '${toRange}')
    WHERE lower("slug") = 'kids'
      AND (
        "seo_meta_title" LIKE '%' || '${fromRange}' || '%'
        OR "seo_meta_description" LIKE '%' || '${fromRange}' || '%'
      );

    UPDATE "_pages_v" SET
      "version_seo_meta_title" = replace("version_seo_meta_title", '${fromRange}', '${toRange}'),
      "version_seo_meta_description" = replace("version_seo_meta_description", '${fromRange}', '${toRange}')
    WHERE lower("version_slug") = 'kids'
      AND (
        "version_seo_meta_title" LIKE '%' || '${fromRange}' || '%'
        OR "version_seo_meta_description" LIKE '%' || '${fromRange}' || '%'
      );

    UPDATE "pages_blocks_hero" block
    SET "eyebrow" = replace(block."eyebrow", '${fromAge}', '${toAge}')
    FROM "pages" page
    WHERE page."id" = block."_parent_id"
      AND lower(page."slug") = 'kids'
      AND block."eyebrow" LIKE '%' || '${fromAge}' || '%';

    UPDATE "_pages_v_blocks_hero" block
    SET "eyebrow" = replace(block."eyebrow", '${fromAge}', '${toAge}')
    FROM "_pages_v" page
    WHERE page."id" = block."_parent_id"
      AND lower(page."version_slug") = 'kids'
      AND block."eyebrow" LIKE '%' || '${fromAge}' || '%';

    UPDATE "pages_blocks_content" block
    SET "body" = replace(block."body"::text, 'aged ${fromAge}', 'aged ${toAge}')::jsonb
    FROM "pages" page
    WHERE page."id" = block."_parent_id"
      AND lower(page."slug") = 'kids'
      AND block."body"::text LIKE '%aged ${fromAge}%';

    UPDATE "_pages_v_blocks_content" block
    SET "body" = replace(block."body"::text, 'aged ${fromAge}', 'aged ${toAge}')::jsonb
    FROM "_pages_v" page
    WHERE page."id" = block."_parent_id"
      AND lower(page."version_slug") = 'kids'
      AND block."body"::text LIKE '%aged ${fromAge}%';

    UPDATE "pages_blocks_feature_grid_items" item
    SET
      "title" = replace(replace(replace(replace(item."title", '${fromAge}', '${toAge}'), '${fromRange}', '${toRange}'), '${fromCrecheAge}', '${toCrecheAge}'), '${fromCrecheRange}', '${toCrecheRange}'),
      "description" = replace(replace(item."description", '${fromAge}', '${toAge}'), '${fromRange}', '${toRange}')
    FROM "pages_blocks_feature_grid" block
    JOIN "pages" page ON page."id" = block."_parent_id"
    WHERE item."_parent_id" = block."id"
      AND lower(page."slug") IN ('home', 'visit', 'kids')
      AND (
        item."title" LIKE '%' || '${fromAge}' || '%'
        OR item."title" LIKE '%' || '${fromRange}' || '%'
        OR item."title" LIKE '%' || '${fromCrecheAge}' || '%'
        OR item."title" LIKE '%' || '${fromCrecheRange}' || '%'
        OR item."description" LIKE '%' || '${fromAge}' || '%'
        OR item."description" LIKE '%' || '${fromRange}' || '%'
      );

    UPDATE "_pages_v_blocks_feature_grid_items" item
    SET
      "title" = replace(replace(replace(replace(item."title", '${fromAge}', '${toAge}'), '${fromRange}', '${toRange}'), '${fromCrecheAge}', '${toCrecheAge}'), '${fromCrecheRange}', '${toCrecheRange}'),
      "description" = replace(replace(item."description", '${fromAge}', '${toAge}'), '${fromRange}', '${toRange}')
    FROM "_pages_v_blocks_feature_grid" block
    JOIN "_pages_v" page ON page."id" = block."_parent_id"
    WHERE item."_parent_id" = block."id"
      AND lower(page."version_slug") IN ('home', 'visit', 'kids')
      AND (
        item."title" LIKE '%' || '${fromAge}' || '%'
        OR item."title" LIKE '%' || '${fromRange}' || '%'
        OR item."title" LIKE '%' || '${fromCrecheAge}' || '%'
        OR item."title" LIKE '%' || '${fromCrecheRange}' || '%'
        OR item."description" LIKE '%' || '${fromAge}' || '%'
        OR item."description" LIKE '%' || '${fromRange}' || '%'
      );

    UPDATE "pages_blocks_accordion_items" item
    SET "answer" = replace(replace(replace(replace(item."answer", '${fromAge}', '${toAge}'), '${fromRange}', '${toRange}'), '${fromCrecheAge}', '${toCrecheAge}'), '${fromCrecheRange}', '${toCrecheRange}')
    FROM "pages_blocks_accordion" block
    JOIN "pages" page ON page."id" = block."_parent_id"
    WHERE item."_parent_id" = block."id"
      AND lower(page."slug") IN ('kids', 'easter', 'faq')
      AND (
        item."answer" LIKE '%' || '${fromAge}' || '%'
        OR item."answer" LIKE '%' || '${fromRange}' || '%'
        OR item."answer" LIKE '%' || '${fromCrecheAge}' || '%'
        OR item."answer" LIKE '%' || '${fromCrecheRange}' || '%'
      );

    UPDATE "_pages_v_blocks_accordion_items" item
    SET "answer" = replace(replace(replace(replace(item."answer", '${fromAge}', '${toAge}'), '${fromRange}', '${toRange}'), '${fromCrecheAge}', '${toCrecheAge}'), '${fromCrecheRange}', '${toCrecheRange}')
    FROM "_pages_v_blocks_accordion" block
    JOIN "_pages_v" page ON page."id" = block."_parent_id"
    WHERE item."_parent_id" = block."id"
      AND lower(page."version_slug") IN ('kids', 'easter', 'faq')
      AND (
        item."answer" LIKE '%' || '${fromAge}' || '%'
        OR item."answer" LIKE '%' || '${fromRange}' || '%'
        OR item."answer" LIKE '%' || '${fromCrecheAge}' || '%'
        OR item."answer" LIKE '%' || '${fromCrecheRange}' || '%'
      );
  `
}

export const EV_KIDS_AGES_1_TO_12_UP_SQL = ageCopySql('0', '1')

// This content correction is intentionally one-way. Reversing every matching
// 1-12 value could overwrite copy editors create after deployment.
export const EV_KIDS_AGES_1_TO_12_DOWN_SQL = 'SELECT 1;'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(EV_KIDS_AGES_1_TO_12_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(EV_KIDS_AGES_1_TO_12_DOWN_SQL))
}
