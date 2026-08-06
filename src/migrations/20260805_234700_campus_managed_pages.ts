import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export const CAMPUS_MANAGED_PAGES_UP_SQL = String.raw`
  ALTER TABLE "campuses" ADD COLUMN "page_content_enabled" boolean DEFAULT false;
  ALTER TABLE "campuses" ADD COLUMN "page_content_brand_name" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_tagline" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_location_label" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_seo_title" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_seo_description" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_service_day" varchar DEFAULT 'Sunday';
  ALTER TABLE "campuses" ADD COLUMN "page_content_service_time_label" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_service_opens" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_service_closes" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_service_duration" varchar DEFAULT 'Approximately 75 minutes';
  ALTER TABLE "campuses" ADD COLUMN "page_content_kids_program" boolean DEFAULT false;
  ALTER TABLE "campuses" ADD COLUMN "page_content_kids_ages" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_hero_image_path" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_map_url" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_parking_info" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_cta_heading" varchar DEFAULT 'See you this Sunday';
  ALTER TABLE "campuses" ADD COLUMN "page_content_cta_text" varchar;
  ALTER TABLE "campuses" ADD COLUMN "page_content_cta_label" varchar DEFAULT 'Plan your visit';
  ALTER TABLE "campuses" ADD COLUMN "page_content_cta_href" varchar DEFAULT '/visit';

  CREATE TABLE "campuses_page_content_gallery_images" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "src" varchar,
    "alt" varchar
  );

  CREATE TABLE "campuses_blocks_upcoming_events" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "eyebrow" varchar DEFAULT 'What’s on',
    "heading" varchar DEFAULT 'Upcoming events',
    "campus_filter_id" integer,
    "block_name" varchar
  );

  ALTER TABLE "campuses_page_content_gallery_images"
    ADD CONSTRAINT "campuses_page_content_gallery_images_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "public"."campuses"("id")
    ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campuses_blocks_upcoming_events"
    ADD CONSTRAINT "campuses_blocks_upcoming_events_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "public"."campuses"("id")
    ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campuses_blocks_upcoming_events"
    ADD CONSTRAINT "campuses_blocks_upcoming_events_campus_filter_id_campuses_id_fk"
    FOREIGN KEY ("campus_filter_id") REFERENCES "public"."campuses"("id")
    ON DELETE set null ON UPDATE no action;

  CREATE INDEX "campuses_page_content_gallery_images_order_idx"
    ON "campuses_page_content_gallery_images" USING btree ("_order");
  CREATE INDEX "campuses_page_content_gallery_images_parent_id_idx"
    ON "campuses_page_content_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "campuses_blocks_upcoming_events_order_idx"
    ON "campuses_blocks_upcoming_events" USING btree ("_order");
  CREATE INDEX "campuses_blocks_upcoming_events_parent_id_idx"
    ON "campuses_blocks_upcoming_events" USING btree ("_parent_id");
  CREATE INDEX "campuses_blocks_upcoming_events_path_idx"
    ON "campuses_blocks_upcoming_events" USING btree ("_path");
  CREATE INDEX "campuses_blocks_upcoming_events_campus_filter_idx"
    ON "campuses_blocks_upcoming_events" USING btree ("campus_filter_id");

  UPDATE "campuses"
  SET
    "address_street" = COALESCE(NULLIF("address_street", ''), CASE "slug"
      WHEN 'central' THEN '80 Olsen Avenue'
      WHEN 'north' THEN '9-11 Rothwell Avenue'
      WHEN 'unichurch' THEN '24 Princes Street'
    END),
    "address_city" = COALESCE(NULLIF("address_city", ''), CASE "slug"
      WHEN 'central' THEN 'Hillsborough, Auckland'
      WHEN 'north' THEN 'Rosedale, Auckland'
      WHEN 'unichurch' THEN 'Auckland'
    END),
    "address_postal_code" = COALESCE(NULLIF("address_postal_code", ''), CASE "slug"
      WHEN 'unichurch' THEN '1010'
      ELSE ''
    END),
    "description" = COALESCE(
      "description",
      jsonb_build_object(
        'root', jsonb_build_object(
          'type', 'root',
          'children', jsonb_build_array(
            jsonb_build_object(
              'type', 'paragraph',
              'children', jsonb_build_array(
                jsonb_build_object(
                  'type', 'text',
                  'text', CASE "slug"
                    WHEN 'central' THEN 'Ev Central meets in Hillsborough, south-central Auckland. We are a diverse, vibrant community of people from all walks of life. Whether you live nearby or are visiting, you are welcome here. Our Sunday services feature live worship, an engaging message, and genuine community.'
                    WHEN 'north' THEN 'Ev North is located in Rosedale on the North Shore, serving families and individuals across the wider Shore community. We are a warm, welcoming church with a heart for people at every stage of life. Our services are relaxed and family-friendly, with excellent programs for kids of all ages.'
                    WHEN 'unichurch' THEN 'Unichurch is our campus expression specifically for university students. Meeting on Sunday evenings, it is the perfect way to end your weekend and start your week. If you are a student at the University of Auckland or any tertiary institution in the city, this is your community. Expect relaxed vibes, real conversations, and a space to explore faith.'
                  END,
                  'format', 0,
                  'detail', 0,
                  'mode', 'normal',
                  'style', '',
                  'version', 1
                )
              ),
              'direction', NULL,
              'format', '',
              'indent', 0,
              'textFormat', 0,
              'textStyle', '',
              'version', 1
            )
          ),
          'direction', NULL,
          'format', '',
          'indent', 0,
          'version', 1
        )
      )
    ),
    "page_content_enabled" = true,
    "page_content_brand_name" = CASE "slug"
      WHEN 'central' THEN 'Ev Central'
      WHEN 'north' THEN 'Ev North'
      WHEN 'unichurch' THEN 'Unichurch'
    END,
    "page_content_tagline" = CASE "slug"
      WHEN 'central' THEN 'In the heart of the city'
      WHEN 'north' THEN 'Community on the Shore'
      WHEN 'unichurch' THEN 'Faith on campus'
    END,
    "page_content_location_label" = CASE "slug"
      WHEN 'central' THEN 'Hillsborough, Auckland'
      WHEN 'north' THEN 'Rosedale, Auckland'
      WHEN 'unichurch' THEN 'University of Auckland'
    END,
    "page_content_seo_title" = CASE
      WHEN "slug" = 'unichurch' THEN 'Unichurch | Student Church Auckland | University of Auckland'
      ELSE "name" || ' Campus | Ev Church Auckland'
    END,
    "page_content_seo_description" = CASE "slug"
      WHEN 'central' THEN 'Join Ev Central at 80 Olsen Avenue, Hillsborough, Auckland. Services every Sunday 10:15 am. A welcoming community in Hillsborough, Auckland.'
      WHEN 'north' THEN 'Join Ev North at 9-11 Rothwell Avenue, Rosedale, Auckland. Services every Sunday 10:15 am. A welcoming community in Rosedale, Auckland.'
      WHEN 'unichurch' THEN 'Join Unichurch at the University of Auckland. A student church for university and tertiary students in Auckland. Sunday 5:15 pm.'
    END,
    "page_content_service_day" = 'Sunday',
    "page_content_service_time_label" = CASE "slug"
      WHEN 'central' THEN 'Sunday 10:15 am'
      WHEN 'north' THEN 'Sunday 10:15 am'
      WHEN 'unichurch' THEN 'Sunday 5:15 pm'
    END,
    "page_content_service_opens" = CASE "slug"
      WHEN 'unichurch' THEN '17:15'
      ELSE '10:15'
    END,
    "page_content_service_closes" = CASE "slug"
      WHEN 'unichurch' THEN '18:30'
      ELSE '11:30'
    END,
    "page_content_service_duration" = 'Approximately 75 minutes',
    "page_content_kids_program" = "slug" IN ('central', 'north'),
    "page_content_kids_ages" = CASE
      WHEN "slug" IN ('central', 'north') THEN 'Available for ages 1 to 12'
      ELSE NULL
    END,
    "page_content_hero_image_path" = CASE "slug"
      WHEN 'central' THEN '/images/campus-central/photo-3b4be562.jpg'
      WHEN 'north' THEN '/images/homepage/carousel-c645786c.jpg'
      WHEN 'unichurch' THEN '/images/campus-unichurch/photo-3cb597b9.jpg'
    END,
    "page_content_map_url" = CASE "slug"
      WHEN 'central' THEN 'https://www.google.com/maps?q=80+Olsen+Avenue+Hillsborough+Auckland'
      WHEN 'north' THEN 'https://www.google.com/maps?q=9-11+Rothwell+Avenue+Rosedale+Auckland'
      WHEN 'unichurch' THEN 'https://www.google.com/maps?q=24+Princes+Street+Auckland'
    END,
    "page_content_parking_info" = 'Parking is available on site. If you need any help finding us, feel free to get in touch.',
    "page_content_cta_heading" = 'See you this Sunday',
    "page_content_cta_text" = CASE "slug"
      WHEN 'central' THEN 'We would love to welcome you to Ev Central. Come as you are. Everyone has a place here.'
      WHEN 'north' THEN 'We would love to welcome you to Ev North. Come as you are. Everyone has a place here.'
      WHEN 'unichurch' THEN 'We would love to welcome you to Unichurch. Come as you are. Everyone has a place here.'
    END,
    "page_content_cta_label" = 'Plan your visit',
    "page_content_cta_href" = '/visit'
  WHERE "slug" IN ('central', 'north', 'unichurch');

  INSERT INTO "campuses_page_content_gallery_images" (
    "_order", "_parent_id", "id", "src", "alt"
  )
  SELECT images."image_order", campuses."id", images."id", images."src", images."alt"
  FROM (VALUES
    (1, 'central', 'central-gallery-1', '/images/campus-central/photo-9018bc8d.jpg', 'Live worship at Ev Church Central campus in Hillsborough Auckland'),
    (2, 'central', 'central-gallery-2', '/images/campus-central/photo-c1a8d4f7.jpg', 'Community gathering at Ev Church Central Auckland'),
    (3, 'central', 'central-gallery-3', '/images/campus-central/photo-e85b8b0f.jpg', 'People connecting at Ev Church Central Hillsborough'),
    (4, 'central', 'central-gallery-4', '/images/campus-central/photo-f38f53fe.jpg', 'Sunday service gathering at Ev Church Central Auckland'),
    (1, 'north', 'north-gallery-1', '/images/homepage/carousel-3c68ddf1.jpg', 'Families at Ev Church North campus Rosedale Auckland'),
    (2, 'north', 'north-gallery-2', '/images/homepage/carousel-168f386e.jpg', 'Community at Ev Church North Shore Auckland'),
    (3, 'north', 'north-gallery-3', '/images/homepage/carousel-9a8d8943.jpg', 'Live worship at Ev Church North Rosedale Auckland'),
    (4, 'north', 'north-gallery-4', '/images/homepage/carousel-70ac2785.jpg', 'Sunday gathering at Ev Church North campus Auckland'),
    (1, 'unichurch', 'unichurch-gallery-1', '/images/campus-unichurch/photo-4e451abd.jpg', 'University students at Unichurch Auckland'),
    (2, 'unichurch', 'unichurch-gallery-2', '/images/campus-unichurch/photo-af1c0355.jpg', 'Worship at Unichurch student church Auckland'),
    (3, 'unichurch', 'unichurch-gallery-3', '/images/campus-unichurch/photo-be476efc.jpg', 'Student community at Unichurch University of Auckland'),
    (4, 'unichurch', 'unichurch-gallery-4', '/images/campus-unichurch/photo-d912efee.jpg', 'Sunday evening gathering at Unichurch Auckland')
  ) AS images("image_order", "slug", "id", "src", "alt")
  JOIN "campuses" ON "campuses"."slug" = images."slug";

  INSERT INTO "campuses_blocks_upcoming_events" (
    "_order", "_parent_id", "_path", "id", "eyebrow", "heading", "campus_filter_id"
  )
  SELECT
    1,
    "id",
    'layout',
    'campus-upcoming-events-' || "slug",
    'What’s on',
    'Upcoming events',
    "id"
  FROM "campuses"
  WHERE "slug" IN ('central', 'north', 'unichurch');
`

export const CAMPUS_MANAGED_PAGES_DOWN_SQL = String.raw`
  DROP TABLE "campuses_blocks_upcoming_events" CASCADE;
  DROP TABLE "campuses_page_content_gallery_images" CASCADE;
  ALTER TABLE "campuses" DROP COLUMN "page_content_enabled";
  ALTER TABLE "campuses" DROP COLUMN "page_content_brand_name";
  ALTER TABLE "campuses" DROP COLUMN "page_content_tagline";
  ALTER TABLE "campuses" DROP COLUMN "page_content_location_label";
  ALTER TABLE "campuses" DROP COLUMN "page_content_seo_title";
  ALTER TABLE "campuses" DROP COLUMN "page_content_seo_description";
  ALTER TABLE "campuses" DROP COLUMN "page_content_service_day";
  ALTER TABLE "campuses" DROP COLUMN "page_content_service_time_label";
  ALTER TABLE "campuses" DROP COLUMN "page_content_service_opens";
  ALTER TABLE "campuses" DROP COLUMN "page_content_service_closes";
  ALTER TABLE "campuses" DROP COLUMN "page_content_service_duration";
  ALTER TABLE "campuses" DROP COLUMN "page_content_kids_program";
  ALTER TABLE "campuses" DROP COLUMN "page_content_kids_ages";
  ALTER TABLE "campuses" DROP COLUMN "page_content_hero_image_path";
  ALTER TABLE "campuses" DROP COLUMN "page_content_map_url";
  ALTER TABLE "campuses" DROP COLUMN "page_content_parking_info";
  ALTER TABLE "campuses" DROP COLUMN "page_content_cta_heading";
  ALTER TABLE "campuses" DROP COLUMN "page_content_cta_text";
  ALTER TABLE "campuses" DROP COLUMN "page_content_cta_label";
  ALTER TABLE "campuses" DROP COLUMN "page_content_cta_href";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(CAMPUS_MANAGED_PAGES_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(CAMPUS_MANAGED_PAGES_DOWN_SQL))
}
