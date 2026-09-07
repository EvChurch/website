import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE speakers ADD COLUMN rock_person_id numeric;
    ALTER TABLE blog_posts ADD COLUMN api_bible_fums_token varchar;
    ALTER TABLE _blog_posts_v ADD COLUMN version_api_bible_fums_token varchar;
    ALTER TYPE enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'prepareSermonArticle';
    ALTER TYPE enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'prepareSermonArticle';
    ALTER TYPE enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'advanceSermonArticles';
    ALTER TYPE enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'advanceSermonArticles';
    CREATE TYPE enum_sermon_articles_status AS ENUM ('transcribing', 'drafting', 'review', 'published', 'failed');
    CREATE TABLE sermon_articles (
      id serial PRIMARY KEY,
      sermon_id integer NOT NULL REFERENCES sermons(id) ON DELETE RESTRICT,
      production_id integer NOT NULL REFERENCES sermon_productions(id) ON DELETE RESTRICT,
      title varchar NOT NULL, author varchar NOT NULL, review_email varchar NOT NULL, rock_person_id numeric NOT NULL,
      series_id integer REFERENCES sermon_series(id) ON DELETE SET NULL,
      passage_reference varchar,
      audio_id integer REFERENCES sermon_work_files(id) ON DELETE RESTRICT,
      status enum_sermon_articles_status NOT NULL DEFAULT 'transcribing',
      transcript varchar, krisp_import_started_at timestamptz(3), review_ready_at timestamptz(3), krisp_import_id varchar, krisp_upload_url varchar,
      krisp_upload_expires_at timestamptz(3), krisp_uploaded boolean DEFAULT false,
      blocks jsonb, questions jsonb, revision varchar NOT NULL,
      lease_token varchar, lease_expires_at timestamptz(3), attempts numeric DEFAULT 0,
      error varchar, review_sent_at timestamptz(3), blog_post_id integer REFERENCES blog_posts(id) ON DELETE SET NULL,
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX sermon_articles_sermon_idx ON sermon_articles(sermon_id);
    CREATE INDEX sermon_articles_production_idx ON sermon_articles(production_id);
    CREATE INDEX sermon_articles_series_idx ON sermon_articles(series_id);
    CREATE INDEX sermon_articles_audio_idx ON sermon_articles(audio_id);
    CREATE INDEX sermon_articles_status_idx ON sermon_articles(status);
    CREATE INDEX sermon_articles_blog_post_idx ON sermon_articles(blog_post_id);
    CREATE INDEX sermon_articles_created_at_idx ON sermon_articles(created_at);
    CREATE INDEX sermon_articles_updated_at_idx ON sermon_articles(updated_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN sermon_articles_id integer REFERENCES sermon_articles(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_sermon_articles_id_idx ON payload_locked_documents_rels(sermon_articles_id);
  `)
}
export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`
    DO $$ BEGIN IF EXISTS (SELECT 1 FROM sermon_articles) THEN RAISE EXCEPTION 'Preserve sermon articles before rolling back'; END IF; END $$;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN sermon_articles_id;
    DROP TABLE sermon_articles;
    DROP TYPE enum_sermon_articles_status;
    ALTER TABLE speakers DROP COLUMN rock_person_id;
    ALTER TABLE blog_posts DROP COLUMN api_bible_fums_token;
    ALTER TABLE _blog_posts_v DROP COLUMN version_api_bible_fums_token;
  `)
}
