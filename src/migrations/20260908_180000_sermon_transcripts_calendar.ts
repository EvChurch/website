import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE sermons ADD COLUMN audio_transcript jsonb, ADD COLUMN generated_topics jsonb, ADD COLUMN topic_suggestions jsonb;
    ALTER TABLE sermon_productions ADD COLUMN calendar_notice varchar;
    ALTER TABLE sermon_settings
      ADD COLUMN calendar_spreadsheet_id varchar,
      ADD COLUMN calendar_worksheet varchar,
      ADD COLUMN calendar_date_column varchar DEFAULT 'B',
      ADD COLUMN calendar_title_header varchar DEFAULT 'Sunday Topic',
      ADD COLUMN calendar_series_header varchar DEFAULT 'Series',
      ADD COLUMN calendar_passage_header varchar DEFAULT 'Bible Reading';
    CREATE TABLE sermon_settings_calendar_campuses (
      _order integer NOT NULL, _parent_id integer NOT NULL REFERENCES sermon_settings(id) ON DELETE CASCADE,
      id varchar PRIMARY KEY, campus_id integer NOT NULL REFERENCES campuses(id) ON DELETE SET NULL, preacher_header varchar NOT NULL
    );
    CREATE INDEX sermon_settings_calendar_campuses_order_idx ON sermon_settings_calendar_campuses(_order);
    CREATE INDEX sermon_settings_calendar_campuses_parent_id_idx ON sermon_settings_calendar_campuses(_parent_id);
    CREATE INDEX sermon_settings_calendar_campuses_campus_idx ON sermon_settings_calendar_campuses(campus_id);
    CREATE TABLE sermon_settings_calendar_speakers (
      _order integer NOT NULL, _parent_id integer NOT NULL REFERENCES sermon_settings(id) ON DELETE CASCADE,
      id varchar PRIMARY KEY, label varchar NOT NULL, speaker_id integer NOT NULL REFERENCES speakers(id) ON DELETE SET NULL
    );
    CREATE INDEX sermon_settings_calendar_speakers_order_idx ON sermon_settings_calendar_speakers(_order);
    CREATE INDEX sermon_settings_calendar_speakers_parent_id_idx ON sermon_settings_calendar_speakers(_parent_id);
    CREATE INDEX sermon_settings_calendar_speakers_speaker_idx ON sermon_settings_calendar_speakers(speaker_id);
    CREATE TYPE enum_sermon_transcripts_status AS ENUM ('transcribing','tagging','complete','superseded','failed');
    CREATE TABLE sermon_transcripts (
      id serial PRIMARY KEY,
      sermon_id integer NOT NULL REFERENCES sermons(id) ON DELETE RESTRICT,
      production_id integer NOT NULL REFERENCES sermon_productions(id) ON DELETE RESTRICT,
      published_audio_id integer NOT NULL REFERENCES sermon_audio(id) ON DELETE RESTRICT,
      title varchar NOT NULL, status enum_sermon_transcripts_status NOT NULL DEFAULT 'transcribing',
      audio_id integer REFERENCES sermon_work_files(id) ON DELETE RESTRICT,
      transcript varchar, segments jsonb, audio_offset numeric DEFAULT 0,
      krisp_import_started_at timestamptz(3), krisp_import_id varchar, krisp_upload_url varchar,
      krisp_upload_expires_at timestamptz(3), krisp_uploaded boolean DEFAULT false,
      lease_token varchar, lease_expires_at timestamptz(3), error varchar,
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE INDEX sermon_transcripts_sermon_idx ON sermon_transcripts(sermon_id);
    CREATE UNIQUE INDEX sermon_transcripts_production_idx ON sermon_transcripts(production_id);
    CREATE INDEX sermon_transcripts_published_audio_idx ON sermon_transcripts(published_audio_id);
    CREATE INDEX sermon_transcripts_audio_idx ON sermon_transcripts(audio_id);
    CREATE INDEX sermon_transcripts_status_idx ON sermon_transcripts(status);
    CREATE INDEX sermon_transcripts_updated_at_idx ON sermon_transcripts(updated_at);
    CREATE INDEX sermon_transcripts_created_at_idx ON sermon_transcripts(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN sermon_transcripts_id integer REFERENCES sermon_transcripts(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_sermon_transcripts_id_idx ON payload_locked_documents_rels(sermon_transcripts_id);
    ALTER TYPE enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'advanceSermonTranscripts';
    ALTER TYPE enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'advanceSermonTranscripts';
  `)
}
export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`
    DO $$ BEGIN IF EXISTS (SELECT 1 FROM sermon_transcripts) THEN RAISE EXCEPTION 'Preserve sermon transcripts before rolling back'; END IF; END $$;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN sermon_transcripts_id;
    DROP TABLE sermon_transcripts;
    DROP TYPE enum_sermon_transcripts_status;
    DROP TABLE sermon_settings_calendar_campuses, sermon_settings_calendar_speakers;
    ALTER TABLE sermon_settings DROP COLUMN calendar_spreadsheet_id, DROP COLUMN calendar_worksheet, DROP COLUMN calendar_date_column,
      DROP COLUMN calendar_title_header, DROP COLUMN calendar_series_header, DROP COLUMN calendar_passage_header;
    ALTER TABLE sermon_productions DROP COLUMN calendar_notice;
    ALTER TABLE sermons DROP COLUMN audio_transcript, DROP COLUMN generated_topics, DROP COLUMN topic_suggestions;
  `)
}
