import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import {
  SITE_FEEDBACK_EMAIL_NOTIFICATIONS_DOWN_SQL,
  SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL,
  down,
  up,
} from '../migrations/20260813_site_feedback_email_notifications'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('Site feedback email notifications migration', () => {
  it('keeps all historical submissions disabled and unaddressed', () => {
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL).toContain(
      '"notification_status" "enum_feedback_submissions_notification_status" NOT NULL DEFAULT \'disabled\'',
    )
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL).toContain(
      '"notification_attempt_count" numeric NOT NULL DEFAULT 0',
    )
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL).toContain(
      '"notification_recipient" varchar',
    )
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL).not.toMatch(
      /UPDATE\s+"feedback_submissions"/i,
    )
  })

  it('adds the editable initial recipient without replacing Site Settings', () => {
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL).toContain(
      '"feedback_notification_recipient" varchar DEFAULT \'tataihono@ev.church\'',
    )
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL).not.toMatch(
      /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?"site_settings"/i,
    )
  })

  it('adds the scheduled-job support without destructive schema drift', () => {
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL).toContain(
      "ADD VALUE IF NOT EXISTS 'sendSiteFeedbackNotification'",
    )
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL).toContain(
      "ADD VALUE IF NOT EXISTS 'reconcileSiteFeedbackNotifications'",
    )
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL).toContain(
      'CREATE TABLE IF NOT EXISTS "payload_jobs_stats"',
    )
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL).not.toMatch(
      /DROP TABLE "(?:users_sessions|rock_connection_signup_nonces|rock_connection_signup_rate_limits|site_feedback_rate_limits)"/,
    )
  })

  it('ships matching snapshot fields and indexes', () => {
    const snapshot = JSON.parse(
      readFileSync(
        new URL(
          '../migrations/20260813_site_feedback_email_notifications.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as {
      tables: Record<
        string,
        {
          columns: Record<string, { default?: unknown; notNull: boolean; type: string }>
          indexes: Record<string, unknown>
        }
      >
    }

    const feedback = snapshot.tables['public.feedback_submissions']
    expect(feedback.columns).toMatchObject({
      notification_status: { notNull: true },
      notification_recipient: { type: 'varchar', notNull: false },
      notification_attempt_count: { type: 'numeric', notNull: true },
      notification_window_started_at: {
        type: 'timestamp(3) with time zone',
        notNull: false,
      },
      notification_lease_expires_at: {
        type: 'timestamp(3) with time zone',
        notNull: false,
      },
    })
    expect(feedback.indexes).toHaveProperty(
      'feedback_submissions_notification_status_idx',
    )
    expect(feedback.indexes).toHaveProperty(
      'feedback_submissions_notification_lease_expires_at_idx',
    )
    expect(snapshot.tables['public.site_settings'].columns).toHaveProperty(
      'feedback_notification_recipient',
    )
  })

  it('runs one atomic SQL batch in each direction', async () => {
    const upArgs = migrationArgs()
    await up(upArgs.args)
    expect(upArgs.execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_DOWN_SQL).toContain(
      'Cannot roll back feedback notifications while notification state exists',
    )
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_DOWN_SQL).not.toContain(
      'DROP TABLE IF EXISTS "payload_jobs_stats"',
    )
    expect(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_DOWN_SQL).not.toContain(
      'DROP COLUMN IF EXISTS "meta"',
    )
  })
})
