import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export const EXACT_CAMPUS_MAP_LOCATIONS_UP_SQL = String.raw`
  UPDATE "campuses"
  SET "page_content_map_url" = CASE "slug"
    WHEN 'north' THEN 'https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U'
    WHEN 'central' THEN 'https://www.google.com/maps/place/?q=place_id%3AChIJAYvdBVVGDW0ReTxTjSRowE8'
    WHEN 'unichurch' THEN 'https://www.google.com/maps/place/?q=place_id%3AChIJVxR51PxHDW0RGv02V7ClS-o'
  END
  WHERE
    ("slug" = 'north' AND "page_content_map_url" = 'https://www.google.com/maps?q=9-11+Rothwell+Avenue+Rosedale+Auckland')
    OR ("slug" = 'central' AND "page_content_map_url" = 'https://www.google.com/maps?q=80+Olsen+Avenue+Hillsborough+Auckland')
    OR ("slug" = 'unichurch' AND "page_content_map_url" = 'https://www.google.com/maps?q=24+Princes+Street+Auckland');
`

export const EXACT_CAMPUS_MAP_LOCATIONS_DOWN_SQL = String.raw`
  UPDATE "campuses"
  SET "page_content_map_url" = CASE "slug"
    WHEN 'north' THEN 'https://www.google.com/maps?q=9-11+Rothwell+Avenue+Rosedale+Auckland'
    WHEN 'central' THEN 'https://www.google.com/maps?q=80+Olsen+Avenue+Hillsborough+Auckland'
    WHEN 'unichurch' THEN 'https://www.google.com/maps?q=24+Princes+Street+Auckland'
  END
  WHERE
    ("slug" = 'north' AND "page_content_map_url" = 'https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U')
    OR ("slug" = 'central' AND "page_content_map_url" = 'https://www.google.com/maps/place/?q=place_id%3AChIJAYvdBVVGDW0ReTxTjSRowE8')
    OR ("slug" = 'unichurch' AND "page_content_map_url" = 'https://www.google.com/maps/place/?q=place_id%3AChIJVxR51PxHDW0RGv02V7ClS-o');
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(EXACT_CAMPUS_MAP_LOCATIONS_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(EXACT_CAMPUS_MAP_LOCATIONS_DOWN_SQL))
}
