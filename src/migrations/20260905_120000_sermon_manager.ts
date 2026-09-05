import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TYPE enum_users_roles ADD VALUE IF NOT EXISTS 'sermon-manager';
    ALTER TYPE enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'prepareSermonAudio';
    ALTER TYPE enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'prepareSermonAudio';
    ALTER TABLE sermons ALTER COLUMN resource_id DROP NOT NULL;
    ALTER TABLE speakers ALTER COLUMN resource_id DROP NOT NULL;
    ALTER TABLE sermon_series ALTER COLUMN resource_id DROP NOT NULL;
    ALTER TABLE topics ALTER COLUMN resource_id DROP NOT NULL;
    ALTER TABLE sermons ALTER COLUMN is_published SET DEFAULT false;
    ALTER TABLE sermons ADD COLUMN audio_campus_id integer REFERENCES campuses(id) ON DELETE SET NULL;
    CREATE INDEX sermons_audio_campus_idx ON sermons(audio_campus_id);

    CREATE TABLE sermon_work_files (
      id serial PRIMARY KEY,
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now(),
      url varchar, thumbnail_u_r_l varchar, filename varchar, mime_type varchar, filesize numeric,
      width numeric, height numeric, focal_x numeric, focal_y numeric, prefix varchar DEFAULT 'sermon-work'
    );
    CREATE UNIQUE INDEX sermon_work_files_filename_idx ON sermon_work_files(filename);
    CREATE INDEX sermon_work_files_updated_at_idx ON sermon_work_files(updated_at);
    CREATE INDEX sermon_work_files_created_at_idx ON sermon_work_files(created_at);
    CREATE TYPE enum_sermon_productions_status AS ENUM ('importing', 'editable', 'rendering', 'ready', 'published', 'failed', 'discarded');
    CREATE TABLE sermon_productions (
      id serial PRIMARY KEY,
      sermon_id integer NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
      base_sermon_revision varchar NOT NULL, source_name varchar NOT NULL, drive_file_id varchar, drive_modified_time varchar,
      campus_id integer REFERENCES campuses(id) ON DELETE SET NULL,
      status enum_sermon_productions_status NOT NULL DEFAULT 'importing', job_token varchar NOT NULL,
      source_id integer REFERENCES sermon_work_files(id) ON DELETE SET NULL,
      listening_copy_id integer REFERENCES sermon_work_files(id) ON DELETE SET NULL,
      output_id integer REFERENCES sermon_work_files(id) ON DELETE SET NULL,
      intro_id integer REFERENCES sermon_work_files(id) ON DELETE SET NULL,
      outro_id integer REFERENCES sermon_work_files(id) ON DELETE SET NULL,
      source_duration numeric, output_duration numeric, peaks jsonb, start numeric, "end" numeric,
      metadata jsonb, error varchar, published_audio_id integer REFERENCES sermon_audio(id) ON DELETE SET NULL,
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE INDEX sermon_productions_sermon_idx ON sermon_productions(sermon_id);
    CREATE INDEX sermon_productions_updated_at_idx ON sermon_productions(updated_at);
    CREATE INDEX sermon_productions_created_at_idx ON sermon_productions(created_at);
    CREATE TABLE sermon_settings (
      id serial PRIMARY KEY,
      intro_id integer REFERENCES sermon_work_files(id) ON DELETE SET NULL,
      outro_id integer REFERENCES sermon_work_files(id) ON DELETE SET NULL,
      updated_at timestamptz(3), created_at timestamptz(3)
    );
    CREATE TABLE sermon_settings_drive_folders (
      _order integer NOT NULL, _parent_id integer NOT NULL REFERENCES sermon_settings(id) ON DELETE CASCADE,
      id varchar PRIMARY KEY, campus_id integer NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
      folder_id varchar NOT NULL
    );
    CREATE INDEX sermon_settings_drive_folders_order_idx ON sermon_settings_drive_folders(_order);
    CREATE INDEX sermon_settings_drive_folders_parent_id_idx ON sermon_settings_drive_folders(_parent_id);
    ALTER TABLE payload_locked_documents_rels
      ADD COLUMN sermon_productions_id integer REFERENCES sermon_productions(id) ON DELETE CASCADE,
      ADD COLUMN sermon_work_files_id integer REFERENCES sermon_work_files(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_sermon_productions_id_idx ON payload_locked_documents_rels(sermon_productions_id);
    CREATE INDEX payload_locked_documents_rels_sermon_work_files_id_idx ON payload_locked_documents_rels(sermon_work_files_id);
  `)
}

export async function down({ db }: MigrateDownArgs) {
  // Do not silently destroy locally authored sermons or audio during rollback.
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM sermon_productions) OR EXISTS (SELECT 1 FROM sermon_work_files)
        OR EXISTS (SELECT 1 FROM sermons WHERE resource_id IS NULL)
        OR EXISTS (SELECT 1 FROM speakers WHERE resource_id IS NULL)
        OR EXISTS (SELECT 1 FROM topics WHERE resource_id IS NULL)
        OR EXISTS (SELECT 1 FROM sermon_series WHERE resource_id IS NULL)
      THEN RAISE EXCEPTION 'Sermon Manager contains authored content. Export it and review rollback before continuing.';
      END IF;
    END $$;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN sermon_productions_id, DROP COLUMN sermon_work_files_id;
    DROP TABLE sermon_settings_drive_folders, sermon_settings, sermon_productions, sermon_work_files;
    DROP TYPE enum_sermon_productions_status;
    ALTER TABLE sermons DROP COLUMN audio_campus_id;
    ALTER TABLE sermons ALTER COLUMN is_published SET DEFAULT true;
    ALTER TABLE sermons ALTER COLUMN resource_id SET NOT NULL;
    ALTER TABLE speakers ALTER COLUMN resource_id SET NOT NULL;
    ALTER TABLE topics ALTER COLUMN resource_id SET NOT NULL;
    ALTER TABLE sermon_series ALTER COLUMN resource_id SET NOT NULL;
    DELETE FROM users_roles WHERE value::text = 'sermon-manager';
  `)
  // PostgreSQL enum additions are retained so queued job history remains readable.
}
