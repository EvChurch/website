import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  SITE_FEEDBACK_EMAIL_NOTIFICATIONS_DOWN_SQL,
  SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL,
} from '../migrations/20260813_site_feedback_email_notifications'

const databaseUrl = process.env.SITE_FEEDBACK_MIGRATION_TEST_DATABASE_URL

function assertDisposableDatabase(value: string): void {
  const url = new URL(value)
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/site_feedback_test'
  ) {
    throw new Error(
      'SITE_FEEDBACK_MIGRATION_TEST_DATABASE_URL must target local database site_feedback_test',
    )
  }
}

describe.skipIf(!databaseUrl)(
  'Site feedback email notifications migration on PostgreSQL',
  () => {
    let client: Client

    beforeAll(async () => {
      assertDisposableDatabase(databaseUrl as string)
      client = new Client({ connectionString: databaseUrl })
      await client.connect()
    })

    afterAll(async () => client?.end())

    async function resetFixture() {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      await client.query(`
        CREATE TABLE site_settings (id serial PRIMARY KEY);
        INSERT INTO site_settings DEFAULT VALUES;
        CREATE TYPE enum_payload_jobs_log_task_slug AS ENUM ('fullSermonSync');
        CREATE TYPE enum_payload_jobs_task_slug AS ENUM ('fullSermonSync');
        CREATE TABLE payload_jobs (
          id serial PRIMARY KEY,
          task_slug enum_payload_jobs_task_slug
        );
        CREATE TABLE feedback_submissions (
          id serial PRIMARY KEY,
          comment varchar NOT NULL,
          source_url varchar NOT NULL,
          client_address_digest varchar NOT NULL,
          updated_at timestamp(3) with time zone NOT NULL DEFAULT now(),
          created_at timestamp(3) with time zone NOT NULL DEFAULT now()
        );
        INSERT INTO feedback_submissions
          (comment, source_url, client_address_digest)
        VALUES ('Historical', 'https://www.ev.church/', 'digest');
      `)
    }

    it('preserves historical rows as disabled while initializing the recipient', async () => {
      await resetFixture()
      await client.query(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL)

      const historical = await client.query(`
        SELECT notification_status, notification_recipient,
               notification_attempt_count, notification_window_started_at
        FROM feedback_submissions WHERE id = 1
      `)
      expect(historical.rows).toEqual([
        {
          notification_status: 'disabled',
          notification_recipient: null,
          notification_attempt_count: 0,
          notification_window_started_at: null,
        },
      ])
      const settings = await client.query(
        'SELECT feedback_notification_recipient FROM site_settings WHERE id = 1',
      )
      expect(settings.rows).toEqual([
        { feedback_notification_recipient: 'tataihono@ev.church' },
      ])

      const jobTypes = await client.query(`
        SELECT enumlabel FROM pg_enum
        WHERE enumtypid = 'enum_payload_jobs_task_slug'::regtype
        ORDER BY enumsortorder
      `)
      expect(jobTypes.rows).toEqual([
        { enumlabel: 'fullSermonSync' },
        { enumlabel: 'sendSiteFeedbackNotification' },
        { enumlabel: 'reconcileSiteFeedbackNotifications' },
      ])
      const jobsStats = await client.query(
        "SELECT to_regclass('public.payload_jobs_stats')::text AS table_name",
      )
      expect(jobsStats.rows).toEqual([{ table_name: 'payload_jobs_stats' }])
    })

    it('rolls down only when no notification state has been used', async () => {
      await resetFixture()
      await client.query(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL)
      await client.query(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_DOWN_SQL)

      const columns = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'feedback_submissions'
          AND column_name LIKE 'notification_%'
      `)
      expect(columns.rows).toEqual([])
    })
  },
)
