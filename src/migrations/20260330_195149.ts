import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'content-lead', 'editor');
  CREATE TYPE "public"."enum_pages_blocks_hero_buttons_variant" AS ENUM('primary', 'secondary', 'text');
  CREATE TYPE "public"."enum_pages_blocks_hero_overlay_style" AS ENUM('default', 'cinematic', 'leftToRight');
  CREATE TYPE "public"."enum_pages_blocks_hero_min_height" AS ENUM('50vh', '70vh', '80vh', '85vh');
  CREATE TYPE "public"."enum_pages_blocks_content_alignment" AS ENUM('left', 'center', 'right');
  CREATE TYPE "public"."enum_pages_blocks_cta_buttons_variant" AS ENUM('primary', 'secondary');
  CREATE TYPE "public"."enum_pages_blocks_cta_color_preset" AS ENUM('primary-red', 'light', 'dark');
  CREATE TYPE "public"."enum_pages_blocks_card_grid_data_source" AS ENUM('campuses', 'events', 'team-members');
  CREATE TYPE "public"."enum_pages_blocks_feature_grid_items_icon" AS ENUM('smile', 'graduation', 'coffee', 'users', 'clock', 'heart', 'music', 'book', 'chat', 'star', 'globe', 'shield');
  CREATE TYPE "public"."enum_pages_blocks_feature_grid_layout" AS ENUM('twoColumn', 'threeColumn', 'fourColumn');
  CREATE TYPE "public"."enum_pages_blocks_feature_grid_style" AS ENUM('iconTop', 'iconLeft');
  CREATE TYPE "public"."enum_pages_blocks_timeline_theme" AS ENUM('dark', 'light');
  CREATE TYPE "public"."enum_pages_blocks_blockquote_style" AS ENUM('centered', 'leftBorder');
  CREATE TYPE "public"."enum_pages_blocks_form_embed_form_type" AS ENUM('contact', 'signup');
  CREATE TYPE "public"."enum_pages_blocks_form_embed_layout" AS ENUM('full', 'centered');
  CREATE TYPE "public"."enum_pages_blocks_manual_card_grid_card_style" AS ENUM('info', 'imageOverlay', 'imageTop', 'alternatingRows');
  CREATE TYPE "public"."enum_pages_blocks_manual_card_grid_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum_pages_blocks_photo_strip_layout" AS ENUM('horizontalScroll', 'grid4', 'grid2', 'masonry');
  CREATE TYPE "public"."enum_pages_blocks_page_header_theme" AS ENUM('dark', 'light');
  CREATE TYPE "public"."enum_pages_blocks_gospel_stepper_steps_image_position" AS ENUM('left', 'right', 'background');
  CREATE TYPE "public"."enum_pages_blocks_gospel_stepper_final_c_t_a_buttons_variant" AS ENUM('primary', 'secondary');
  CREATE TYPE "public"."enum_pages_template" AS ENUM('standard', 'ministry', 'seasonal-event', 'simple-content');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_buttons_variant" AS ENUM('primary', 'secondary', 'text');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_overlay_style" AS ENUM('default', 'cinematic', 'leftToRight');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_min_height" AS ENUM('50vh', '70vh', '80vh', '85vh');
  CREATE TYPE "public"."enum__pages_v_blocks_content_alignment" AS ENUM('left', 'center', 'right');
  CREATE TYPE "public"."enum__pages_v_blocks_cta_buttons_variant" AS ENUM('primary', 'secondary');
  CREATE TYPE "public"."enum__pages_v_blocks_cta_color_preset" AS ENUM('primary-red', 'light', 'dark');
  CREATE TYPE "public"."enum__pages_v_blocks_card_grid_data_source" AS ENUM('campuses', 'events', 'team-members');
  CREATE TYPE "public"."enum__pages_v_blocks_feature_grid_items_icon" AS ENUM('smile', 'graduation', 'coffee', 'users', 'clock', 'heart', 'music', 'book', 'chat', 'star', 'globe', 'shield');
  CREATE TYPE "public"."enum__pages_v_blocks_feature_grid_layout" AS ENUM('twoColumn', 'threeColumn', 'fourColumn');
  CREATE TYPE "public"."enum__pages_v_blocks_feature_grid_style" AS ENUM('iconTop', 'iconLeft');
  CREATE TYPE "public"."enum__pages_v_blocks_timeline_theme" AS ENUM('dark', 'light');
  CREATE TYPE "public"."enum__pages_v_blocks_blockquote_style" AS ENUM('centered', 'leftBorder');
  CREATE TYPE "public"."enum__pages_v_blocks_form_embed_form_type" AS ENUM('contact', 'signup');
  CREATE TYPE "public"."enum__pages_v_blocks_form_embed_layout" AS ENUM('full', 'centered');
  CREATE TYPE "public"."enum__pages_v_blocks_manual_card_grid_card_style" AS ENUM('info', 'imageOverlay', 'imageTop', 'alternatingRows');
  CREATE TYPE "public"."enum__pages_v_blocks_manual_card_grid_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum__pages_v_blocks_photo_strip_layout" AS ENUM('horizontalScroll', 'grid4', 'grid2', 'masonry');
  CREATE TYPE "public"."enum__pages_v_blocks_page_header_theme" AS ENUM('dark', 'light');
  CREATE TYPE "public"."enum__pages_v_blocks_gospel_stepper_steps_image_position" AS ENUM('left', 'right', 'background');
  CREATE TYPE "public"."enum__pages_v_blocks_gospel_stepper_final_c_t_a_buttons_variant" AS ENUM('primary', 'secondary');
  CREATE TYPE "public"."enum__pages_v_version_template" AS ENUM('standard', 'ministry', 'seasonal-event', 'simple-content');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_blog_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__blog_posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_announcements_color_preset" AS ENUM('primary-red', 'light', 'dark');
  CREATE TYPE "public"."enum_announcements_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__announcements_v_version_color_preset" AS ENUM('primary-red', 'light', 'dark');
  CREATE TYPE "public"."enum__announcements_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_team_members_team_group" AS ENUM('staff', 'leadership', 'apprentices');
  CREATE TYPE "public"."enum_events_registration_status" AS ENUM('open', 'full', 'closed', 'coming-soon');
  CREATE TYPE "public"."enum_site_settings_social_links_platform" AS ENUM('facebook', 'instagram', 'youtube', 'spotify', 'apple-podcasts');
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"rock_image_guid" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_medium_url" varchar,
  	"sizes_medium_width" numeric,
  	"sizes_medium_height" numeric,
  	"sizes_medium_mime_type" varchar,
  	"sizes_medium_filesize" numeric,
  	"sizes_medium_filename" varchar,
  	"sizes_large_url" varchar,
  	"sizes_large_width" numeric,
  	"sizes_large_height" numeric,
  	"sizes_large_mime_type" varchar,
  	"sizes_large_filesize" numeric,
  	"sizes_large_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar,
  	"sizes_thumbnail_webp_url" varchar,
  	"sizes_thumbnail_webp_width" numeric,
  	"sizes_thumbnail_webp_height" numeric,
  	"sizes_thumbnail_webp_mime_type" varchar,
  	"sizes_thumbnail_webp_filesize" numeric,
  	"sizes_thumbnail_webp_filename" varchar,
  	"sizes_medium_webp_url" varchar,
  	"sizes_medium_webp_width" numeric,
  	"sizes_medium_webp_height" numeric,
  	"sizes_medium_webp_mime_type" varchar,
  	"sizes_medium_webp_filesize" numeric,
  	"sizes_medium_webp_filename" varchar,
  	"sizes_large_webp_url" varchar,
  	"sizes_large_webp_width" numeric,
  	"sizes_large_webp_height" numeric,
  	"sizes_large_webp_mime_type" varchar,
  	"sizes_large_webp_filesize" numeric,
  	"sizes_large_webp_filename" varchar
  );
  
  CREATE TABLE "pages_blocks_hero_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"variant" "enum_pages_blocks_hero_buttons_variant"
  );
  
  CREATE TABLE "pages_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"highlighted_text" varchar,
  	"subtitle" varchar,
  	"supporting_text" varchar,
  	"semantic_h1" boolean DEFAULT false,
  	"overlay_style" "enum_pages_blocks_hero_overlay_style" DEFAULT 'default',
  	"min_height" "enum_pages_blocks_hero_min_height" DEFAULT '70vh',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" jsonb,
  	"image_id" integer,
  	"alignment" "enum_pages_blocks_content_alignment" DEFAULT 'left',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_cta_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"variant" "enum_pages_blocks_cta_buttons_variant"
  );
  
  CREATE TABLE "pages_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"text" varchar,
  	"background_image_id" integer,
  	"color_preset" "enum_pages_blocks_cta_color_preset" DEFAULT 'primary-red',
  	"supporting_text" varchar,
  	"accent_color" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_card_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"data_source" "enum_pages_blocks_card_grid_data_source",
  	"campus_filter_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_accordion_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "pages_blocks_accordion" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"allow_multiple" boolean DEFAULT false,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_image_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "pages_blocks_image_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"caption" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_feature_grid_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "enum_pages_blocks_feature_grid_items_icon",
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "pages_blocks_feature_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"layout" "enum_pages_blocks_feature_grid_layout" DEFAULT 'twoColumn',
  	"style" "enum_pages_blocks_feature_grid_style" DEFAULT 'iconLeft',
  	"accent_color" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_timeline_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"year" varchar,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "pages_blocks_timeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"theme" "enum_pages_blocks_timeline_theme" DEFAULT 'dark',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_stats_grid_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"stat" varchar,
  	"stat_label" varchar,
  	"description" varchar,
  	"scripture" varchar,
  	"scripture_reference" varchar
  );
  
  CREATE TABLE "pages_blocks_stats_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_blockquote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"quote" varchar,
  	"attribution" varchar,
  	"style" "enum_pages_blocks_blockquote_style" DEFAULT 'centered',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_form_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"form_type" "enum_pages_blocks_form_embed_form_type",
  	"form_title" varchar,
  	"layout" "enum_pages_blocks_form_embed_layout" DEFAULT 'centered',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_manual_card_grid_cards_details" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "pages_blocks_manual_card_grid_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"title" varchar,
  	"subtitle" varchar,
  	"description" varchar,
  	"eyebrow" varchar,
  	"address" varchar,
  	"href" varchar,
  	"link_label" varchar
  );
  
  CREATE TABLE "pages_blocks_manual_card_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"card_style" "enum_pages_blocks_manual_card_grid_card_style" DEFAULT 'info',
  	"columns" "enum_pages_blocks_manual_card_grid_columns" DEFAULT '3',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_photo_strip_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "pages_blocks_photo_strip" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"layout" "enum_pages_blocks_photo_strip_layout" DEFAULT 'horizontalScroll',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_page_header" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"theme" "enum_pages_blocks_page_header_theme" DEFAULT 'dark',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_gospel_stepper_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"step_title" varchar,
  	"heading" varchar,
  	"body" jsonb,
  	"image_id" integer,
  	"image_position" "enum_pages_blocks_gospel_stepper_steps_image_position" DEFAULT 'right'
  );
  
  CREATE TABLE "pages_blocks_gospel_stepper_final_c_t_a_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"variant" "enum_pages_blocks_gospel_stepper_final_c_t_a_buttons_variant"
  );
  
  CREATE TABLE "pages_blocks_gospel_stepper" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"final_c_t_a_heading" varchar,
  	"final_c_t_a_text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_latest_sermon" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Latest Sermon',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"template" "enum_pages_template" DEFAULT 'standard',
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_pages_v_blocks_hero_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"variant" "enum__pages_v_blocks_hero_buttons_variant",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"highlighted_text" varchar,
  	"subtitle" varchar,
  	"supporting_text" varchar,
  	"semantic_h1" boolean DEFAULT false,
  	"overlay_style" "enum__pages_v_blocks_hero_overlay_style" DEFAULT 'default',
  	"min_height" "enum__pages_v_blocks_hero_min_height" DEFAULT '70vh',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" jsonb,
  	"image_id" integer,
  	"alignment" "enum__pages_v_blocks_content_alignment" DEFAULT 'left',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_cta_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"variant" "enum__pages_v_blocks_cta_buttons_variant",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"text" varchar,
  	"background_image_id" integer,
  	"color_preset" "enum__pages_v_blocks_cta_color_preset" DEFAULT 'primary-red',
  	"supporting_text" varchar,
  	"accent_color" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_card_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"data_source" "enum__pages_v_blocks_card_grid_data_source",
  	"campus_filter_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_accordion_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_accordion" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"allow_multiple" boolean DEFAULT false,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_image_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_image_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"caption" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_feature_grid_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"icon" "enum__pages_v_blocks_feature_grid_items_icon",
  	"title" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_feature_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"layout" "enum__pages_v_blocks_feature_grid_layout" DEFAULT 'twoColumn',
  	"style" "enum__pages_v_blocks_feature_grid_style" DEFAULT 'iconLeft',
  	"accent_color" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_timeline_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" varchar,
  	"title" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_timeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"theme" "enum__pages_v_blocks_timeline_theme" DEFAULT 'dark',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_stats_grid_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"stat" varchar,
  	"stat_label" varchar,
  	"description" varchar,
  	"scripture" varchar,
  	"scripture_reference" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_stats_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_blockquote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"quote" varchar,
  	"attribution" varchar,
  	"style" "enum__pages_v_blocks_blockquote_style" DEFAULT 'centered',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_form_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"form_type" "enum__pages_v_blocks_form_embed_form_type",
  	"form_title" varchar,
  	"layout" "enum__pages_v_blocks_form_embed_layout" DEFAULT 'centered',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_manual_card_grid_cards_details" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_manual_card_grid_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"title" varchar,
  	"subtitle" varchar,
  	"description" varchar,
  	"eyebrow" varchar,
  	"address" varchar,
  	"href" varchar,
  	"link_label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_manual_card_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"card_style" "enum__pages_v_blocks_manual_card_grid_card_style" DEFAULT 'info',
  	"columns" "enum__pages_v_blocks_manual_card_grid_columns" DEFAULT '3',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_photo_strip_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_photo_strip" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"layout" "enum__pages_v_blocks_photo_strip_layout" DEFAULT 'horizontalScroll',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_page_header" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"description" varchar,
  	"theme" "enum__pages_v_blocks_page_header_theme" DEFAULT 'dark',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_gospel_stepper_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"step_title" varchar,
  	"heading" varchar,
  	"body" jsonb,
  	"image_id" integer,
  	"image_position" "enum__pages_v_blocks_gospel_stepper_steps_image_position" DEFAULT 'right',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_gospel_stepper_final_c_t_a_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"variant" "enum__pages_v_blocks_gospel_stepper_final_c_t_a_buttons_variant",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_gospel_stepper" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"final_c_t_a_heading" varchar,
  	"final_c_t_a_text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_latest_sermon" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Latest Sermon',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_template" "enum__pages_v_version_template" DEFAULT 'standard',
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_og_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "blog_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"author" varchar,
  	"published_date" timestamp(3) with time zone,
  	"featured_image_id" integer,
  	"sermon_series_id" integer,
  	"content" jsonb,
  	"excerpt" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_blog_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_blog_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_author" varchar,
  	"version_published_date" timestamp(3) with time zone,
  	"version_featured_image_id" integer,
  	"version_sermon_series_id" integer,
  	"version_content" jsonb,
  	"version_excerpt" varchar,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__blog_posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "announcements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"message" jsonb,
  	"link_label" varchar,
  	"link_href" varchar,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"color_preset" "enum_announcements_color_preset" DEFAULT 'primary-red',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_announcements_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_announcements_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_message" jsonb,
  	"version_link_label" varchar,
  	"version_link_href" varchar,
  	"version_start_date" timestamp(3) with time zone,
  	"version_end_date" timestamp(3) with time zone,
  	"version_color_preset" "enum__announcements_v_version_color_preset" DEFAULT 'primary-red',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__announcements_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "campuses_slide_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "campuses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"rock_id" numeric NOT NULL,
  	"address_street" varchar,
  	"address_city" varchar,
  	"address_postal_code" varchar,
  	"geo_point_lat" numeric,
  	"geo_point_lng" numeric,
  	"google_place_id" varchar,
  	"service_times" varchar,
  	"description" jsonb,
  	"order" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"featured_image_id" integer,
  	"establishment_year" numeric,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "team_members" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"full_name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"rock_person_id" numeric NOT NULL,
  	"role" varchar,
  	"email" varchar,
  	"photo_id" integer,
  	"team_group" "enum_team_members_team_group",
  	"order" numeric DEFAULT 0,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"rock_event_id" numeric NOT NULL,
  	"summary" jsonb,
  	"image_id" integer,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"campus_id" integer,
  	"location_name" varchar,
  	"location_address" varchar,
  	"contact_person_name" varchar,
  	"contact_person_email" varchar,
  	"contact_person_phone" varchar,
  	"contact_person_photo_id" integer,
  	"registration_url" varchar,
  	"registration_status" "enum_events_registration_status",
  	"registration_capacity" numeric,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "connect_groups_leaders" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"email" varchar
  );
  
  CREATE TABLE "connect_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"rock_group_id" numeric NOT NULL,
  	"description" jsonb,
  	"location_name" varchar,
  	"location_address" varchar,
  	"image_id" integer,
  	"capacity" numeric,
  	"campus_id" integer,
  	"is_active" boolean DEFAULT true,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "registrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"rock_registration_id" numeric NOT NULL,
  	"event_id" integer,
  	"public_name" varchar,
  	"is_active" boolean,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"capacity" numeric,
  	"current_count" numeric DEFAULT 0,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sermon_series" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"resource_id" varchar NOT NULL,
  	"background_image_id" integer,
  	"banner_image_id" integer,
  	"foreground_image_id" integer,
  	"is_published" boolean DEFAULT true,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sermons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"resource_id" varchar NOT NULL,
  	"audio_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"duration" numeric,
  	"passage_reference" varchar,
  	"search_text" varchar,
  	"is_published" boolean DEFAULT true,
  	"transcript" varchar,
  	"summary" varchar,
  	"discussion_questions" jsonb,
  	"enriched_scripture" jsonb,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sermons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"sermon_series_id" integer,
  	"speakers_id" integer,
  	"topics_id" integer,
  	"scriptures_id" integer
  );
  
  CREATE TABLE "speakers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"resource_id" varchar NOT NULL,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "topics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"resource_id" varchar NOT NULL,
  	"category_id" integer,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"resource_id" varchar NOT NULL,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "scriptures" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"resource_id" varchar NOT NULL,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sermon_audio" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"duration" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"pages_id" integer,
  	"blog_posts_id" integer,
  	"announcements_id" integer,
  	"campuses_id" integer,
  	"team_members_id" integer,
  	"events_id" integer,
  	"connect_groups_id" integer,
  	"registrations_id" integer,
  	"sermon_series_id" integer,
  	"sermons_id" integer,
  	"speakers_id" integer,
  	"topics_id" integer,
  	"categories_id" integer,
  	"scriptures_id" integer,
  	"sermon_audio_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "navigation_main_nav_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar
  );
  
  CREATE TABLE "navigation_main_nav" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "navigation_footer_nav_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL,
  	"meta" varchar
  );
  
  CREATE TABLE "navigation_footer_nav" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL
  );
  
  CREATE TABLE "navigation" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_settings_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_site_settings_social_links_platform",
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"logo_id" integer,
  	"contact_email" varchar,
  	"mailing_address" varchar,
  	"analytics_id" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_buttons" ADD CONSTRAINT "pages_blocks_hero_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_content" ADD CONSTRAINT "pages_blocks_content_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_content" ADD CONSTRAINT "pages_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta_buttons" ADD CONSTRAINT "pages_blocks_cta_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_cta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta" ADD CONSTRAINT "pages_blocks_cta_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta" ADD CONSTRAINT "pages_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_card_grid" ADD CONSTRAINT "pages_blocks_card_grid_campus_filter_id_campuses_id_fk" FOREIGN KEY ("campus_filter_id") REFERENCES "public"."campuses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_card_grid" ADD CONSTRAINT "pages_blocks_card_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_accordion_items" ADD CONSTRAINT "pages_blocks_accordion_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_accordion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_accordion" ADD CONSTRAINT "pages_blocks_accordion_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery_images" ADD CONSTRAINT "pages_blocks_image_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery_images" ADD CONSTRAINT "pages_blocks_image_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_image_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery" ADD CONSTRAINT "pages_blocks_image_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_video" ADD CONSTRAINT "pages_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid_items" ADD CONSTRAINT "pages_blocks_feature_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid" ADD CONSTRAINT "pages_blocks_feature_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_timeline_events" ADD CONSTRAINT "pages_blocks_timeline_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_timeline"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_timeline" ADD CONSTRAINT "pages_blocks_timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_stats_grid_items" ADD CONSTRAINT "pages_blocks_stats_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_stats_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_stats_grid" ADD CONSTRAINT "pages_blocks_stats_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_blockquote" ADD CONSTRAINT "pages_blocks_blockquote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_form_embed" ADD CONSTRAINT "pages_blocks_form_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_manual_card_grid_cards_details" ADD CONSTRAINT "pages_blocks_manual_card_grid_cards_details_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_manual_card_grid_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_manual_card_grid_cards" ADD CONSTRAINT "pages_blocks_manual_card_grid_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_manual_card_grid_cards" ADD CONSTRAINT "pages_blocks_manual_card_grid_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_manual_card_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_manual_card_grid" ADD CONSTRAINT "pages_blocks_manual_card_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_photo_strip_images" ADD CONSTRAINT "pages_blocks_photo_strip_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_photo_strip_images" ADD CONSTRAINT "pages_blocks_photo_strip_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_photo_strip"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_photo_strip" ADD CONSTRAINT "pages_blocks_photo_strip_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_page_header" ADD CONSTRAINT "pages_blocks_page_header_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_gospel_stepper_steps" ADD CONSTRAINT "pages_blocks_gospel_stepper_steps_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_gospel_stepper_steps" ADD CONSTRAINT "pages_blocks_gospel_stepper_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_gospel_stepper"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_gospel_stepper_final_c_t_a_buttons" ADD CONSTRAINT "pages_blocks_gospel_stepper_final_c_t_a_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_gospel_stepper"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_gospel_stepper" ADD CONSTRAINT "pages_blocks_gospel_stepper_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_latest_sermon" ADD CONSTRAINT "pages_blocks_latest_sermon_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_buttons" ADD CONSTRAINT "_pages_v_blocks_hero_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_content" ADD CONSTRAINT "_pages_v_blocks_content_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_content" ADD CONSTRAINT "_pages_v_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cta_buttons" ADD CONSTRAINT "_pages_v_blocks_cta_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_cta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cta" ADD CONSTRAINT "_pages_v_blocks_cta_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cta" ADD CONSTRAINT "_pages_v_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_card_grid" ADD CONSTRAINT "_pages_v_blocks_card_grid_campus_filter_id_campuses_id_fk" FOREIGN KEY ("campus_filter_id") REFERENCES "public"."campuses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_card_grid" ADD CONSTRAINT "_pages_v_blocks_card_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_accordion_items" ADD CONSTRAINT "_pages_v_blocks_accordion_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_accordion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_accordion" ADD CONSTRAINT "_pages_v_blocks_accordion_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_gallery_images" ADD CONSTRAINT "_pages_v_blocks_image_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_gallery_images" ADD CONSTRAINT "_pages_v_blocks_image_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_image_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_gallery" ADD CONSTRAINT "_pages_v_blocks_image_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_video" ADD CONSTRAINT "_pages_v_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid_items" ADD CONSTRAINT "_pages_v_blocks_feature_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid" ADD CONSTRAINT "_pages_v_blocks_feature_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_timeline_events" ADD CONSTRAINT "_pages_v_blocks_timeline_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_timeline"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_timeline" ADD CONSTRAINT "_pages_v_blocks_timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_stats_grid_items" ADD CONSTRAINT "_pages_v_blocks_stats_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_stats_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_stats_grid" ADD CONSTRAINT "_pages_v_blocks_stats_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_blockquote" ADD CONSTRAINT "_pages_v_blocks_blockquote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_form_embed" ADD CONSTRAINT "_pages_v_blocks_form_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_manual_card_grid_cards_details" ADD CONSTRAINT "_pages_v_blocks_manual_card_grid_cards_details_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_manual_card_grid_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_manual_card_grid_cards" ADD CONSTRAINT "_pages_v_blocks_manual_card_grid_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_manual_card_grid_cards" ADD CONSTRAINT "_pages_v_blocks_manual_card_grid_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_manual_card_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_manual_card_grid" ADD CONSTRAINT "_pages_v_blocks_manual_card_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_photo_strip_images" ADD CONSTRAINT "_pages_v_blocks_photo_strip_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_photo_strip_images" ADD CONSTRAINT "_pages_v_blocks_photo_strip_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_photo_strip"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_photo_strip" ADD CONSTRAINT "_pages_v_blocks_photo_strip_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_page_header" ADD CONSTRAINT "_pages_v_blocks_page_header_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_gospel_stepper_steps" ADD CONSTRAINT "_pages_v_blocks_gospel_stepper_steps_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_gospel_stepper_steps" ADD CONSTRAINT "_pages_v_blocks_gospel_stepper_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_gospel_stepper"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_gospel_stepper_final_c_t_a_buttons" ADD CONSTRAINT "_pages_v_blocks_gospel_stepper_final_c_t_a_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_gospel_stepper"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_gospel_stepper" ADD CONSTRAINT "_pages_v_blocks_gospel_stepper_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_latest_sermon" ADD CONSTRAINT "_pages_v_blocks_latest_sermon_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_sermon_series_id_sermon_series_id_fk" FOREIGN KEY ("sermon_series_id") REFERENCES "public"."sermon_series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_blog_posts_v" ADD CONSTRAINT "_blog_posts_v_parent_id_blog_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_blog_posts_v" ADD CONSTRAINT "_blog_posts_v_version_featured_image_id_media_id_fk" FOREIGN KEY ("version_featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_blog_posts_v" ADD CONSTRAINT "_blog_posts_v_version_sermon_series_id_sermon_series_id_fk" FOREIGN KEY ("version_sermon_series_id") REFERENCES "public"."sermon_series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_announcements_v" ADD CONSTRAINT "_announcements_v_parent_id_announcements_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."announcements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campuses_slide_images" ADD CONSTRAINT "campuses_slide_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campuses_slide_images" ADD CONSTRAINT "campuses_slide_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campuses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campuses" ADD CONSTRAINT "campuses_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "team_members" ADD CONSTRAINT "team_members_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_contact_person_photo_id_media_id_fk" FOREIGN KEY ("contact_person_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "connect_groups_leaders" ADD CONSTRAINT "connect_groups_leaders_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."connect_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "connect_groups" ADD CONSTRAINT "connect_groups_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "connect_groups" ADD CONSTRAINT "connect_groups_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sermon_series" ADD CONSTRAINT "sermon_series_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sermon_series" ADD CONSTRAINT "sermon_series_banner_image_id_media_id_fk" FOREIGN KEY ("banner_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sermon_series" ADD CONSTRAINT "sermon_series_foreground_image_id_media_id_fk" FOREIGN KEY ("foreground_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sermons" ADD CONSTRAINT "sermons_audio_id_sermon_audio_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."sermon_audio"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sermons_rels" ADD CONSTRAINT "sermons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sermons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sermons_rels" ADD CONSTRAINT "sermons_rels_sermon_series_fk" FOREIGN KEY ("sermon_series_id") REFERENCES "public"."sermon_series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sermons_rels" ADD CONSTRAINT "sermons_rels_speakers_fk" FOREIGN KEY ("speakers_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sermons_rels" ADD CONSTRAINT "sermons_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sermons_rels" ADD CONSTRAINT "sermons_rels_scriptures_fk" FOREIGN KEY ("scriptures_id") REFERENCES "public"."scriptures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "topics" ADD CONSTRAINT "topics_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_posts_fk" FOREIGN KEY ("blog_posts_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_announcements_fk" FOREIGN KEY ("announcements_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campuses_fk" FOREIGN KEY ("campuses_id") REFERENCES "public"."campuses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_team_members_fk" FOREIGN KEY ("team_members_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_connect_groups_fk" FOREIGN KEY ("connect_groups_id") REFERENCES "public"."connect_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_registrations_fk" FOREIGN KEY ("registrations_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sermon_series_fk" FOREIGN KEY ("sermon_series_id") REFERENCES "public"."sermon_series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sermons_fk" FOREIGN KEY ("sermons_id") REFERENCES "public"."sermons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_speakers_fk" FOREIGN KEY ("speakers_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scriptures_fk" FOREIGN KEY ("scriptures_id") REFERENCES "public"."scriptures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sermon_audio_fk" FOREIGN KEY ("sermon_audio_id") REFERENCES "public"."sermon_audio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_main_nav_children" ADD CONSTRAINT "navigation_main_nav_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_main_nav"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_main_nav" ADD CONSTRAINT "navigation_main_nav_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_footer_nav_links" ADD CONSTRAINT "navigation_footer_nav_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_footer_nav"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_footer_nav" ADD CONSTRAINT "navigation_footer_nav_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_social_links" ADD CONSTRAINT "site_settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_rock_image_guid_idx" ON "media" USING btree ("rock_image_guid");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_medium_sizes_medium_filename_idx" ON "media" USING btree ("sizes_medium_filename");
  CREATE INDEX "media_sizes_large_sizes_large_filename_idx" ON "media" USING btree ("sizes_large_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE INDEX "media_sizes_thumbnail_webp_sizes_thumbnail_webp_filename_idx" ON "media" USING btree ("sizes_thumbnail_webp_filename");
  CREATE INDEX "media_sizes_medium_webp_sizes_medium_webp_filename_idx" ON "media" USING btree ("sizes_medium_webp_filename");
  CREATE INDEX "media_sizes_large_webp_sizes_large_webp_filename_idx" ON "media" USING btree ("sizes_large_webp_filename");
  CREATE INDEX "pages_blocks_hero_buttons_order_idx" ON "pages_blocks_hero_buttons" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_buttons_parent_id_idx" ON "pages_blocks_hero_buttons" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_order_idx" ON "pages_blocks_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_parent_id_idx" ON "pages_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_path_idx" ON "pages_blocks_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_image_idx" ON "pages_blocks_hero" USING btree ("image_id");
  CREATE INDEX "pages_blocks_content_order_idx" ON "pages_blocks_content" USING btree ("_order");
  CREATE INDEX "pages_blocks_content_parent_id_idx" ON "pages_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_content_path_idx" ON "pages_blocks_content" USING btree ("_path");
  CREATE INDEX "pages_blocks_content_image_idx" ON "pages_blocks_content" USING btree ("image_id");
  CREATE INDEX "pages_blocks_cta_buttons_order_idx" ON "pages_blocks_cta_buttons" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_buttons_parent_id_idx" ON "pages_blocks_cta_buttons" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_order_idx" ON "pages_blocks_cta" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_parent_id_idx" ON "pages_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_path_idx" ON "pages_blocks_cta" USING btree ("_path");
  CREATE INDEX "pages_blocks_cta_background_image_idx" ON "pages_blocks_cta" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_card_grid_order_idx" ON "pages_blocks_card_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_card_grid_parent_id_idx" ON "pages_blocks_card_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_card_grid_path_idx" ON "pages_blocks_card_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_card_grid_campus_filter_idx" ON "pages_blocks_card_grid" USING btree ("campus_filter_id");
  CREATE INDEX "pages_blocks_accordion_items_order_idx" ON "pages_blocks_accordion_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_accordion_items_parent_id_idx" ON "pages_blocks_accordion_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_accordion_order_idx" ON "pages_blocks_accordion" USING btree ("_order");
  CREATE INDEX "pages_blocks_accordion_parent_id_idx" ON "pages_blocks_accordion" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_accordion_path_idx" ON "pages_blocks_accordion" USING btree ("_path");
  CREATE INDEX "pages_blocks_image_gallery_images_order_idx" ON "pages_blocks_image_gallery_images" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_gallery_images_parent_id_idx" ON "pages_blocks_image_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_gallery_images_image_idx" ON "pages_blocks_image_gallery_images" USING btree ("image_id");
  CREATE INDEX "pages_blocks_image_gallery_order_idx" ON "pages_blocks_image_gallery" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_gallery_parent_id_idx" ON "pages_blocks_image_gallery" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_gallery_path_idx" ON "pages_blocks_image_gallery" USING btree ("_path");
  CREATE INDEX "pages_blocks_video_order_idx" ON "pages_blocks_video" USING btree ("_order");
  CREATE INDEX "pages_blocks_video_parent_id_idx" ON "pages_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_video_path_idx" ON "pages_blocks_video" USING btree ("_path");
  CREATE INDEX "pages_blocks_feature_grid_items_order_idx" ON "pages_blocks_feature_grid_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_feature_grid_items_parent_id_idx" ON "pages_blocks_feature_grid_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_order_idx" ON "pages_blocks_feature_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_feature_grid_parent_id_idx" ON "pages_blocks_feature_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_path_idx" ON "pages_blocks_feature_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_timeline_events_order_idx" ON "pages_blocks_timeline_events" USING btree ("_order");
  CREATE INDEX "pages_blocks_timeline_events_parent_id_idx" ON "pages_blocks_timeline_events" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_timeline_order_idx" ON "pages_blocks_timeline" USING btree ("_order");
  CREATE INDEX "pages_blocks_timeline_parent_id_idx" ON "pages_blocks_timeline" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_timeline_path_idx" ON "pages_blocks_timeline" USING btree ("_path");
  CREATE INDEX "pages_blocks_stats_grid_items_order_idx" ON "pages_blocks_stats_grid_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_stats_grid_items_parent_id_idx" ON "pages_blocks_stats_grid_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_stats_grid_order_idx" ON "pages_blocks_stats_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_stats_grid_parent_id_idx" ON "pages_blocks_stats_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_stats_grid_path_idx" ON "pages_blocks_stats_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_blockquote_order_idx" ON "pages_blocks_blockquote" USING btree ("_order");
  CREATE INDEX "pages_blocks_blockquote_parent_id_idx" ON "pages_blocks_blockquote" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_blockquote_path_idx" ON "pages_blocks_blockquote" USING btree ("_path");
  CREATE INDEX "pages_blocks_form_embed_order_idx" ON "pages_blocks_form_embed" USING btree ("_order");
  CREATE INDEX "pages_blocks_form_embed_parent_id_idx" ON "pages_blocks_form_embed" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_form_embed_path_idx" ON "pages_blocks_form_embed" USING btree ("_path");
  CREATE INDEX "pages_blocks_manual_card_grid_cards_details_order_idx" ON "pages_blocks_manual_card_grid_cards_details" USING btree ("_order");
  CREATE INDEX "pages_blocks_manual_card_grid_cards_details_parent_id_idx" ON "pages_blocks_manual_card_grid_cards_details" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_manual_card_grid_cards_order_idx" ON "pages_blocks_manual_card_grid_cards" USING btree ("_order");
  CREATE INDEX "pages_blocks_manual_card_grid_cards_parent_id_idx" ON "pages_blocks_manual_card_grid_cards" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_manual_card_grid_cards_image_idx" ON "pages_blocks_manual_card_grid_cards" USING btree ("image_id");
  CREATE INDEX "pages_blocks_manual_card_grid_order_idx" ON "pages_blocks_manual_card_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_manual_card_grid_parent_id_idx" ON "pages_blocks_manual_card_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_manual_card_grid_path_idx" ON "pages_blocks_manual_card_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_photo_strip_images_order_idx" ON "pages_blocks_photo_strip_images" USING btree ("_order");
  CREATE INDEX "pages_blocks_photo_strip_images_parent_id_idx" ON "pages_blocks_photo_strip_images" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_photo_strip_images_image_idx" ON "pages_blocks_photo_strip_images" USING btree ("image_id");
  CREATE INDEX "pages_blocks_photo_strip_order_idx" ON "pages_blocks_photo_strip" USING btree ("_order");
  CREATE INDEX "pages_blocks_photo_strip_parent_id_idx" ON "pages_blocks_photo_strip" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_photo_strip_path_idx" ON "pages_blocks_photo_strip" USING btree ("_path");
  CREATE INDEX "pages_blocks_page_header_order_idx" ON "pages_blocks_page_header" USING btree ("_order");
  CREATE INDEX "pages_blocks_page_header_parent_id_idx" ON "pages_blocks_page_header" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_page_header_path_idx" ON "pages_blocks_page_header" USING btree ("_path");
  CREATE INDEX "pages_blocks_gospel_stepper_steps_order_idx" ON "pages_blocks_gospel_stepper_steps" USING btree ("_order");
  CREATE INDEX "pages_blocks_gospel_stepper_steps_parent_id_idx" ON "pages_blocks_gospel_stepper_steps" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_gospel_stepper_steps_image_idx" ON "pages_blocks_gospel_stepper_steps" USING btree ("image_id");
  CREATE INDEX "pages_blocks_gospel_stepper_final_c_t_a_buttons_order_idx" ON "pages_blocks_gospel_stepper_final_c_t_a_buttons" USING btree ("_order");
  CREATE INDEX "pages_blocks_gospel_stepper_final_c_t_a_buttons_parent_id_idx" ON "pages_blocks_gospel_stepper_final_c_t_a_buttons" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_gospel_stepper_order_idx" ON "pages_blocks_gospel_stepper" USING btree ("_order");
  CREATE INDEX "pages_blocks_gospel_stepper_parent_id_idx" ON "pages_blocks_gospel_stepper" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_gospel_stepper_path_idx" ON "pages_blocks_gospel_stepper" USING btree ("_path");
  CREATE INDEX "pages_blocks_latest_sermon_order_idx" ON "pages_blocks_latest_sermon" USING btree ("_order");
  CREATE INDEX "pages_blocks_latest_sermon_parent_id_idx" ON "pages_blocks_latest_sermon" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_latest_sermon_path_idx" ON "pages_blocks_latest_sermon" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_seo_seo_og_image_idx" ON "pages" USING btree ("seo_og_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "_pages_v_blocks_hero_buttons_order_idx" ON "_pages_v_blocks_hero_buttons" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_buttons_parent_id_idx" ON "_pages_v_blocks_hero_buttons" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_order_idx" ON "_pages_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_parent_id_idx" ON "_pages_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_path_idx" ON "_pages_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_hero_image_idx" ON "_pages_v_blocks_hero" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_content_order_idx" ON "_pages_v_blocks_content" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_content_parent_id_idx" ON "_pages_v_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_content_path_idx" ON "_pages_v_blocks_content" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_content_image_idx" ON "_pages_v_blocks_content" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_cta_buttons_order_idx" ON "_pages_v_blocks_cta_buttons" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_buttons_parent_id_idx" ON "_pages_v_blocks_cta_buttons" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_order_idx" ON "_pages_v_blocks_cta" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_parent_id_idx" ON "_pages_v_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_path_idx" ON "_pages_v_blocks_cta" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_cta_background_image_idx" ON "_pages_v_blocks_cta" USING btree ("background_image_id");
  CREATE INDEX "_pages_v_blocks_card_grid_order_idx" ON "_pages_v_blocks_card_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_card_grid_parent_id_idx" ON "_pages_v_blocks_card_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_card_grid_path_idx" ON "_pages_v_blocks_card_grid" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_card_grid_campus_filter_idx" ON "_pages_v_blocks_card_grid" USING btree ("campus_filter_id");
  CREATE INDEX "_pages_v_blocks_accordion_items_order_idx" ON "_pages_v_blocks_accordion_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_accordion_items_parent_id_idx" ON "_pages_v_blocks_accordion_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_accordion_order_idx" ON "_pages_v_blocks_accordion" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_accordion_parent_id_idx" ON "_pages_v_blocks_accordion" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_accordion_path_idx" ON "_pages_v_blocks_accordion" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_image_gallery_images_order_idx" ON "_pages_v_blocks_image_gallery_images" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_image_gallery_images_parent_id_idx" ON "_pages_v_blocks_image_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_image_gallery_images_image_idx" ON "_pages_v_blocks_image_gallery_images" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_image_gallery_order_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_image_gallery_parent_id_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_image_gallery_path_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_video_order_idx" ON "_pages_v_blocks_video" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_video_parent_id_idx" ON "_pages_v_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_video_path_idx" ON "_pages_v_blocks_video" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_feature_grid_items_order_idx" ON "_pages_v_blocks_feature_grid_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_feature_grid_items_parent_id_idx" ON "_pages_v_blocks_feature_grid_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_order_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_feature_grid_parent_id_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_path_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_timeline_events_order_idx" ON "_pages_v_blocks_timeline_events" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_timeline_events_parent_id_idx" ON "_pages_v_blocks_timeline_events" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_timeline_order_idx" ON "_pages_v_blocks_timeline" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_timeline_parent_id_idx" ON "_pages_v_blocks_timeline" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_timeline_path_idx" ON "_pages_v_blocks_timeline" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_stats_grid_items_order_idx" ON "_pages_v_blocks_stats_grid_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_stats_grid_items_parent_id_idx" ON "_pages_v_blocks_stats_grid_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_stats_grid_order_idx" ON "_pages_v_blocks_stats_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_stats_grid_parent_id_idx" ON "_pages_v_blocks_stats_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_stats_grid_path_idx" ON "_pages_v_blocks_stats_grid" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_blockquote_order_idx" ON "_pages_v_blocks_blockquote" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_blockquote_parent_id_idx" ON "_pages_v_blocks_blockquote" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_blockquote_path_idx" ON "_pages_v_blocks_blockquote" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_form_embed_order_idx" ON "_pages_v_blocks_form_embed" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_form_embed_parent_id_idx" ON "_pages_v_blocks_form_embed" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_form_embed_path_idx" ON "_pages_v_blocks_form_embed" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_manual_card_grid_cards_details_order_idx" ON "_pages_v_blocks_manual_card_grid_cards_details" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_manual_card_grid_cards_details_parent_id_idx" ON "_pages_v_blocks_manual_card_grid_cards_details" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_manual_card_grid_cards_order_idx" ON "_pages_v_blocks_manual_card_grid_cards" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_manual_card_grid_cards_parent_id_idx" ON "_pages_v_blocks_manual_card_grid_cards" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_manual_card_grid_cards_image_idx" ON "_pages_v_blocks_manual_card_grid_cards" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_manual_card_grid_order_idx" ON "_pages_v_blocks_manual_card_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_manual_card_grid_parent_id_idx" ON "_pages_v_blocks_manual_card_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_manual_card_grid_path_idx" ON "_pages_v_blocks_manual_card_grid" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_photo_strip_images_order_idx" ON "_pages_v_blocks_photo_strip_images" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_photo_strip_images_parent_id_idx" ON "_pages_v_blocks_photo_strip_images" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_photo_strip_images_image_idx" ON "_pages_v_blocks_photo_strip_images" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_photo_strip_order_idx" ON "_pages_v_blocks_photo_strip" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_photo_strip_parent_id_idx" ON "_pages_v_blocks_photo_strip" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_photo_strip_path_idx" ON "_pages_v_blocks_photo_strip" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_page_header_order_idx" ON "_pages_v_blocks_page_header" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_page_header_parent_id_idx" ON "_pages_v_blocks_page_header" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_page_header_path_idx" ON "_pages_v_blocks_page_header" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_gospel_stepper_steps_order_idx" ON "_pages_v_blocks_gospel_stepper_steps" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_gospel_stepper_steps_parent_id_idx" ON "_pages_v_blocks_gospel_stepper_steps" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_gospel_stepper_steps_image_idx" ON "_pages_v_blocks_gospel_stepper_steps" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_gospel_stepper_final_c_t_a_buttons_order_idx" ON "_pages_v_blocks_gospel_stepper_final_c_t_a_buttons" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_gospel_stepper_final_c_t_a_buttons_parent_id_idx" ON "_pages_v_blocks_gospel_stepper_final_c_t_a_buttons" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_gospel_stepper_order_idx" ON "_pages_v_blocks_gospel_stepper" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_gospel_stepper_parent_id_idx" ON "_pages_v_blocks_gospel_stepper" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_gospel_stepper_path_idx" ON "_pages_v_blocks_gospel_stepper" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_latest_sermon_order_idx" ON "_pages_v_blocks_latest_sermon" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_latest_sermon_parent_id_idx" ON "_pages_v_blocks_latest_sermon" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_latest_sermon_path_idx" ON "_pages_v_blocks_latest_sermon" USING btree ("_path");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_seo_version_seo_og_image_idx" ON "_pages_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_autosave_idx" ON "_pages_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");
  CREATE INDEX "blog_posts_featured_image_idx" ON "blog_posts" USING btree ("featured_image_id");
  CREATE INDEX "blog_posts_sermon_series_idx" ON "blog_posts" USING btree ("sermon_series_id");
  CREATE INDEX "blog_posts_updated_at_idx" ON "blog_posts" USING btree ("updated_at");
  CREATE INDEX "blog_posts_created_at_idx" ON "blog_posts" USING btree ("created_at");
  CREATE INDEX "blog_posts__status_idx" ON "blog_posts" USING btree ("_status");
  CREATE INDEX "_blog_posts_v_parent_idx" ON "_blog_posts_v" USING btree ("parent_id");
  CREATE INDEX "_blog_posts_v_version_version_slug_idx" ON "_blog_posts_v" USING btree ("version_slug");
  CREATE INDEX "_blog_posts_v_version_version_featured_image_idx" ON "_blog_posts_v" USING btree ("version_featured_image_id");
  CREATE INDEX "_blog_posts_v_version_version_sermon_series_idx" ON "_blog_posts_v" USING btree ("version_sermon_series_id");
  CREATE INDEX "_blog_posts_v_version_version_updated_at_idx" ON "_blog_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_blog_posts_v_version_version_created_at_idx" ON "_blog_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_blog_posts_v_version_version__status_idx" ON "_blog_posts_v" USING btree ("version__status");
  CREATE INDEX "_blog_posts_v_created_at_idx" ON "_blog_posts_v" USING btree ("created_at");
  CREATE INDEX "_blog_posts_v_updated_at_idx" ON "_blog_posts_v" USING btree ("updated_at");
  CREATE INDEX "_blog_posts_v_latest_idx" ON "_blog_posts_v" USING btree ("latest");
  CREATE INDEX "_blog_posts_v_autosave_idx" ON "_blog_posts_v" USING btree ("autosave");
  CREATE INDEX "announcements_updated_at_idx" ON "announcements" USING btree ("updated_at");
  CREATE INDEX "announcements_created_at_idx" ON "announcements" USING btree ("created_at");
  CREATE INDEX "announcements__status_idx" ON "announcements" USING btree ("_status");
  CREATE INDEX "_announcements_v_parent_idx" ON "_announcements_v" USING btree ("parent_id");
  CREATE INDEX "_announcements_v_version_version_updated_at_idx" ON "_announcements_v" USING btree ("version_updated_at");
  CREATE INDEX "_announcements_v_version_version_created_at_idx" ON "_announcements_v" USING btree ("version_created_at");
  CREATE INDEX "_announcements_v_version_version__status_idx" ON "_announcements_v" USING btree ("version__status");
  CREATE INDEX "_announcements_v_created_at_idx" ON "_announcements_v" USING btree ("created_at");
  CREATE INDEX "_announcements_v_updated_at_idx" ON "_announcements_v" USING btree ("updated_at");
  CREATE INDEX "_announcements_v_latest_idx" ON "_announcements_v" USING btree ("latest");
  CREATE INDEX "campuses_slide_images_order_idx" ON "campuses_slide_images" USING btree ("_order");
  CREATE INDEX "campuses_slide_images_parent_id_idx" ON "campuses_slide_images" USING btree ("_parent_id");
  CREATE INDEX "campuses_slide_images_image_idx" ON "campuses_slide_images" USING btree ("image_id");
  CREATE UNIQUE INDEX "campuses_slug_idx" ON "campuses" USING btree ("slug");
  CREATE UNIQUE INDEX "campuses_rock_id_idx" ON "campuses" USING btree ("rock_id");
  CREATE INDEX "campuses_featured_image_idx" ON "campuses" USING btree ("featured_image_id");
  CREATE INDEX "campuses_updated_at_idx" ON "campuses" USING btree ("updated_at");
  CREATE INDEX "campuses_created_at_idx" ON "campuses" USING btree ("created_at");
  CREATE UNIQUE INDEX "team_members_slug_idx" ON "team_members" USING btree ("slug");
  CREATE UNIQUE INDEX "team_members_rock_person_id_idx" ON "team_members" USING btree ("rock_person_id");
  CREATE INDEX "team_members_photo_idx" ON "team_members" USING btree ("photo_id");
  CREATE INDEX "team_members_updated_at_idx" ON "team_members" USING btree ("updated_at");
  CREATE INDEX "team_members_created_at_idx" ON "team_members" USING btree ("created_at");
  CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");
  CREATE UNIQUE INDEX "events_rock_event_id_idx" ON "events" USING btree ("rock_event_id");
  CREATE INDEX "events_image_idx" ON "events" USING btree ("image_id");
  CREATE INDEX "events_campus_idx" ON "events" USING btree ("campus_id");
  CREATE INDEX "events_contact_person_contact_person_photo_idx" ON "events" USING btree ("contact_person_photo_id");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "connect_groups_leaders_order_idx" ON "connect_groups_leaders" USING btree ("_order");
  CREATE INDEX "connect_groups_leaders_parent_id_idx" ON "connect_groups_leaders" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "connect_groups_slug_idx" ON "connect_groups" USING btree ("slug");
  CREATE UNIQUE INDEX "connect_groups_rock_group_id_idx" ON "connect_groups" USING btree ("rock_group_id");
  CREATE INDEX "connect_groups_image_idx" ON "connect_groups" USING btree ("image_id");
  CREATE INDEX "connect_groups_campus_idx" ON "connect_groups" USING btree ("campus_id");
  CREATE INDEX "connect_groups_updated_at_idx" ON "connect_groups" USING btree ("updated_at");
  CREATE INDEX "connect_groups_created_at_idx" ON "connect_groups" USING btree ("created_at");
  CREATE UNIQUE INDEX "registrations_rock_registration_id_idx" ON "registrations" USING btree ("rock_registration_id");
  CREATE INDEX "registrations_event_idx" ON "registrations" USING btree ("event_id");
  CREATE INDEX "registrations_updated_at_idx" ON "registrations" USING btree ("updated_at");
  CREATE INDEX "registrations_created_at_idx" ON "registrations" USING btree ("created_at");
  CREATE UNIQUE INDEX "sermon_series_slug_idx" ON "sermon_series" USING btree ("slug");
  CREATE UNIQUE INDEX "sermon_series_resource_id_idx" ON "sermon_series" USING btree ("resource_id");
  CREATE INDEX "sermon_series_background_image_idx" ON "sermon_series" USING btree ("background_image_id");
  CREATE INDEX "sermon_series_banner_image_idx" ON "sermon_series" USING btree ("banner_image_id");
  CREATE INDEX "sermon_series_foreground_image_idx" ON "sermon_series" USING btree ("foreground_image_id");
  CREATE INDEX "sermon_series_updated_at_idx" ON "sermon_series" USING btree ("updated_at");
  CREATE INDEX "sermon_series_created_at_idx" ON "sermon_series" USING btree ("created_at");
  CREATE UNIQUE INDEX "sermons_slug_idx" ON "sermons" USING btree ("slug");
  CREATE UNIQUE INDEX "sermons_resource_id_idx" ON "sermons" USING btree ("resource_id");
  CREATE INDEX "sermons_audio_idx" ON "sermons" USING btree ("audio_id");
  CREATE INDEX "sermons_search_text_idx" ON "sermons" USING btree ("search_text");
  CREATE INDEX "sermons_updated_at_idx" ON "sermons" USING btree ("updated_at");
  CREATE INDEX "sermons_created_at_idx" ON "sermons" USING btree ("created_at");
  CREATE INDEX "sermons_rels_order_idx" ON "sermons_rels" USING btree ("order");
  CREATE INDEX "sermons_rels_parent_idx" ON "sermons_rels" USING btree ("parent_id");
  CREATE INDEX "sermons_rels_path_idx" ON "sermons_rels" USING btree ("path");
  CREATE INDEX "sermons_rels_sermon_series_id_idx" ON "sermons_rels" USING btree ("sermon_series_id");
  CREATE INDEX "sermons_rels_speakers_id_idx" ON "sermons_rels" USING btree ("speakers_id");
  CREATE INDEX "sermons_rels_topics_id_idx" ON "sermons_rels" USING btree ("topics_id");
  CREATE INDEX "sermons_rels_scriptures_id_idx" ON "sermons_rels" USING btree ("scriptures_id");
  CREATE UNIQUE INDEX "speakers_slug_idx" ON "speakers" USING btree ("slug");
  CREATE UNIQUE INDEX "speakers_resource_id_idx" ON "speakers" USING btree ("resource_id");
  CREATE INDEX "speakers_updated_at_idx" ON "speakers" USING btree ("updated_at");
  CREATE INDEX "speakers_created_at_idx" ON "speakers" USING btree ("created_at");
  CREATE UNIQUE INDEX "topics_slug_idx" ON "topics" USING btree ("slug");
  CREATE UNIQUE INDEX "topics_resource_id_idx" ON "topics" USING btree ("resource_id");
  CREATE INDEX "topics_category_idx" ON "topics" USING btree ("category_id");
  CREATE INDEX "topics_updated_at_idx" ON "topics" USING btree ("updated_at");
  CREATE INDEX "topics_created_at_idx" ON "topics" USING btree ("created_at");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE UNIQUE INDEX "categories_resource_id_idx" ON "categories" USING btree ("resource_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "scriptures_slug_idx" ON "scriptures" USING btree ("slug");
  CREATE UNIQUE INDEX "scriptures_resource_id_idx" ON "scriptures" USING btree ("resource_id");
  CREATE INDEX "scriptures_updated_at_idx" ON "scriptures" USING btree ("updated_at");
  CREATE INDEX "scriptures_created_at_idx" ON "scriptures" USING btree ("created_at");
  CREATE INDEX "sermon_audio_updated_at_idx" ON "sermon_audio" USING btree ("updated_at");
  CREATE INDEX "sermon_audio_created_at_idx" ON "sermon_audio" USING btree ("created_at");
  CREATE UNIQUE INDEX "sermon_audio_filename_idx" ON "sermon_audio" USING btree ("filename");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_blog_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("blog_posts_id");
  CREATE INDEX "payload_locked_documents_rels_announcements_id_idx" ON "payload_locked_documents_rels" USING btree ("announcements_id");
  CREATE INDEX "payload_locked_documents_rels_campuses_id_idx" ON "payload_locked_documents_rels" USING btree ("campuses_id");
  CREATE INDEX "payload_locked_documents_rels_team_members_id_idx" ON "payload_locked_documents_rels" USING btree ("team_members_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_connect_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("connect_groups_id");
  CREATE INDEX "payload_locked_documents_rels_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("registrations_id");
  CREATE INDEX "payload_locked_documents_rels_sermon_series_id_idx" ON "payload_locked_documents_rels" USING btree ("sermon_series_id");
  CREATE INDEX "payload_locked_documents_rels_sermons_id_idx" ON "payload_locked_documents_rels" USING btree ("sermons_id");
  CREATE INDEX "payload_locked_documents_rels_speakers_id_idx" ON "payload_locked_documents_rels" USING btree ("speakers_id");
  CREATE INDEX "payload_locked_documents_rels_topics_id_idx" ON "payload_locked_documents_rels" USING btree ("topics_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_scriptures_id_idx" ON "payload_locked_documents_rels" USING btree ("scriptures_id");
  CREATE INDEX "payload_locked_documents_rels_sermon_audio_id_idx" ON "payload_locked_documents_rels" USING btree ("sermon_audio_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "navigation_main_nav_children_order_idx" ON "navigation_main_nav_children" USING btree ("_order");
  CREATE INDEX "navigation_main_nav_children_parent_id_idx" ON "navigation_main_nav_children" USING btree ("_parent_id");
  CREATE INDEX "navigation_main_nav_order_idx" ON "navigation_main_nav" USING btree ("_order");
  CREATE INDEX "navigation_main_nav_parent_id_idx" ON "navigation_main_nav" USING btree ("_parent_id");
  CREATE INDEX "navigation_footer_nav_links_order_idx" ON "navigation_footer_nav_links" USING btree ("_order");
  CREATE INDEX "navigation_footer_nav_links_parent_id_idx" ON "navigation_footer_nav_links" USING btree ("_parent_id");
  CREATE INDEX "navigation_footer_nav_order_idx" ON "navigation_footer_nav" USING btree ("_order");
  CREATE INDEX "navigation_footer_nav_parent_id_idx" ON "navigation_footer_nav" USING btree ("_parent_id");
  CREATE INDEX "site_settings_social_links_order_idx" ON "site_settings_social_links" USING btree ("_order");
  CREATE INDEX "site_settings_social_links_parent_id_idx" ON "site_settings_social_links" USING btree ("_parent_id");
  CREATE INDEX "site_settings_logo_idx" ON "site_settings" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "pages_blocks_hero_buttons" CASCADE;
  DROP TABLE "pages_blocks_hero" CASCADE;
  DROP TABLE "pages_blocks_content" CASCADE;
  DROP TABLE "pages_blocks_cta_buttons" CASCADE;
  DROP TABLE "pages_blocks_cta" CASCADE;
  DROP TABLE "pages_blocks_card_grid" CASCADE;
  DROP TABLE "pages_blocks_accordion_items" CASCADE;
  DROP TABLE "pages_blocks_accordion" CASCADE;
  DROP TABLE "pages_blocks_image_gallery_images" CASCADE;
  DROP TABLE "pages_blocks_image_gallery" CASCADE;
  DROP TABLE "pages_blocks_video" CASCADE;
  DROP TABLE "pages_blocks_feature_grid_items" CASCADE;
  DROP TABLE "pages_blocks_feature_grid" CASCADE;
  DROP TABLE "pages_blocks_timeline_events" CASCADE;
  DROP TABLE "pages_blocks_timeline" CASCADE;
  DROP TABLE "pages_blocks_stats_grid_items" CASCADE;
  DROP TABLE "pages_blocks_stats_grid" CASCADE;
  DROP TABLE "pages_blocks_blockquote" CASCADE;
  DROP TABLE "pages_blocks_form_embed" CASCADE;
  DROP TABLE "pages_blocks_manual_card_grid_cards_details" CASCADE;
  DROP TABLE "pages_blocks_manual_card_grid_cards" CASCADE;
  DROP TABLE "pages_blocks_manual_card_grid" CASCADE;
  DROP TABLE "pages_blocks_photo_strip_images" CASCADE;
  DROP TABLE "pages_blocks_photo_strip" CASCADE;
  DROP TABLE "pages_blocks_page_header" CASCADE;
  DROP TABLE "pages_blocks_gospel_stepper_steps" CASCADE;
  DROP TABLE "pages_blocks_gospel_stepper_final_c_t_a_buttons" CASCADE;
  DROP TABLE "pages_blocks_gospel_stepper" CASCADE;
  DROP TABLE "pages_blocks_latest_sermon" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_buttons" CASCADE;
  DROP TABLE "_pages_v_blocks_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_content" CASCADE;
  DROP TABLE "_pages_v_blocks_cta_buttons" CASCADE;
  DROP TABLE "_pages_v_blocks_cta" CASCADE;
  DROP TABLE "_pages_v_blocks_card_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_accordion_items" CASCADE;
  DROP TABLE "_pages_v_blocks_accordion" CASCADE;
  DROP TABLE "_pages_v_blocks_image_gallery_images" CASCADE;
  DROP TABLE "_pages_v_blocks_image_gallery" CASCADE;
  DROP TABLE "_pages_v_blocks_video" CASCADE;
  DROP TABLE "_pages_v_blocks_feature_grid_items" CASCADE;
  DROP TABLE "_pages_v_blocks_feature_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_timeline_events" CASCADE;
  DROP TABLE "_pages_v_blocks_timeline" CASCADE;
  DROP TABLE "_pages_v_blocks_stats_grid_items" CASCADE;
  DROP TABLE "_pages_v_blocks_stats_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_blockquote" CASCADE;
  DROP TABLE "_pages_v_blocks_form_embed" CASCADE;
  DROP TABLE "_pages_v_blocks_manual_card_grid_cards_details" CASCADE;
  DROP TABLE "_pages_v_blocks_manual_card_grid_cards" CASCADE;
  DROP TABLE "_pages_v_blocks_manual_card_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_photo_strip_images" CASCADE;
  DROP TABLE "_pages_v_blocks_photo_strip" CASCADE;
  DROP TABLE "_pages_v_blocks_page_header" CASCADE;
  DROP TABLE "_pages_v_blocks_gospel_stepper_steps" CASCADE;
  DROP TABLE "_pages_v_blocks_gospel_stepper_final_c_t_a_buttons" CASCADE;
  DROP TABLE "_pages_v_blocks_gospel_stepper" CASCADE;
  DROP TABLE "_pages_v_blocks_latest_sermon" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "blog_posts" CASCADE;
  DROP TABLE "_blog_posts_v" CASCADE;
  DROP TABLE "announcements" CASCADE;
  DROP TABLE "_announcements_v" CASCADE;
  DROP TABLE "campuses_slide_images" CASCADE;
  DROP TABLE "campuses" CASCADE;
  DROP TABLE "team_members" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "connect_groups_leaders" CASCADE;
  DROP TABLE "connect_groups" CASCADE;
  DROP TABLE "registrations" CASCADE;
  DROP TABLE "sermon_series" CASCADE;
  DROP TABLE "sermons" CASCADE;
  DROP TABLE "sermons_rels" CASCADE;
  DROP TABLE "speakers" CASCADE;
  DROP TABLE "topics" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "scriptures" CASCADE;
  DROP TABLE "sermon_audio" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "navigation_main_nav_children" CASCADE;
  DROP TABLE "navigation_main_nav" CASCADE;
  DROP TABLE "navigation_footer_nav_links" CASCADE;
  DROP TABLE "navigation_footer_nav" CASCADE;
  DROP TABLE "navigation" CASCADE;
  DROP TABLE "site_settings_social_links" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_pages_blocks_hero_buttons_variant";
  DROP TYPE "public"."enum_pages_blocks_hero_overlay_style";
  DROP TYPE "public"."enum_pages_blocks_hero_min_height";
  DROP TYPE "public"."enum_pages_blocks_content_alignment";
  DROP TYPE "public"."enum_pages_blocks_cta_buttons_variant";
  DROP TYPE "public"."enum_pages_blocks_cta_color_preset";
  DROP TYPE "public"."enum_pages_blocks_card_grid_data_source";
  DROP TYPE "public"."enum_pages_blocks_feature_grid_items_icon";
  DROP TYPE "public"."enum_pages_blocks_feature_grid_layout";
  DROP TYPE "public"."enum_pages_blocks_feature_grid_style";
  DROP TYPE "public"."enum_pages_blocks_timeline_theme";
  DROP TYPE "public"."enum_pages_blocks_blockquote_style";
  DROP TYPE "public"."enum_pages_blocks_form_embed_form_type";
  DROP TYPE "public"."enum_pages_blocks_form_embed_layout";
  DROP TYPE "public"."enum_pages_blocks_manual_card_grid_card_style";
  DROP TYPE "public"."enum_pages_blocks_manual_card_grid_columns";
  DROP TYPE "public"."enum_pages_blocks_photo_strip_layout";
  DROP TYPE "public"."enum_pages_blocks_page_header_theme";
  DROP TYPE "public"."enum_pages_blocks_gospel_stepper_steps_image_position";
  DROP TYPE "public"."enum_pages_blocks_gospel_stepper_final_c_t_a_buttons_variant";
  DROP TYPE "public"."enum_pages_template";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_blocks_hero_buttons_variant";
  DROP TYPE "public"."enum__pages_v_blocks_hero_overlay_style";
  DROP TYPE "public"."enum__pages_v_blocks_hero_min_height";
  DROP TYPE "public"."enum__pages_v_blocks_content_alignment";
  DROP TYPE "public"."enum__pages_v_blocks_cta_buttons_variant";
  DROP TYPE "public"."enum__pages_v_blocks_cta_color_preset";
  DROP TYPE "public"."enum__pages_v_blocks_card_grid_data_source";
  DROP TYPE "public"."enum__pages_v_blocks_feature_grid_items_icon";
  DROP TYPE "public"."enum__pages_v_blocks_feature_grid_layout";
  DROP TYPE "public"."enum__pages_v_blocks_feature_grid_style";
  DROP TYPE "public"."enum__pages_v_blocks_timeline_theme";
  DROP TYPE "public"."enum__pages_v_blocks_blockquote_style";
  DROP TYPE "public"."enum__pages_v_blocks_form_embed_form_type";
  DROP TYPE "public"."enum__pages_v_blocks_form_embed_layout";
  DROP TYPE "public"."enum__pages_v_blocks_manual_card_grid_card_style";
  DROP TYPE "public"."enum__pages_v_blocks_manual_card_grid_columns";
  DROP TYPE "public"."enum__pages_v_blocks_photo_strip_layout";
  DROP TYPE "public"."enum__pages_v_blocks_page_header_theme";
  DROP TYPE "public"."enum__pages_v_blocks_gospel_stepper_steps_image_position";
  DROP TYPE "public"."enum__pages_v_blocks_gospel_stepper_final_c_t_a_buttons_variant";
  DROP TYPE "public"."enum__pages_v_version_template";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_blog_posts_status";
  DROP TYPE "public"."enum__blog_posts_v_version_status";
  DROP TYPE "public"."enum_announcements_color_preset";
  DROP TYPE "public"."enum_announcements_status";
  DROP TYPE "public"."enum__announcements_v_version_color_preset";
  DROP TYPE "public"."enum__announcements_v_version_status";
  DROP TYPE "public"."enum_team_members_team_group";
  DROP TYPE "public"."enum_events_registration_status";
  DROP TYPE "public"."enum_site_settings_social_links_platform";`)
}
