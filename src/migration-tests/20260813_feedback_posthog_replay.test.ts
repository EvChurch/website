import { describe, expect, it, vi } from 'vitest'

import {
  down,
  FEEDBACK_POSTHOG_REPLAY_DOWN_SQL,
  FEEDBACK_POSTHOG_REPLAY_UP_SQL,
  up,
} from '../migrations/20260813_110000_feedback_posthog_replay'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('feedback PostHog replay migration', () => {
  it('adds nullable replay metadata without rewriting existing feedback', () => {
    expect(FEEDBACK_POSTHOG_REPLAY_UP_SQL).toContain(
      'ADD COLUMN IF NOT EXISTS "post_hog_session_id" varchar',
    )
    expect(FEEDBACK_POSTHOG_REPLAY_UP_SQL).toContain(
      'ADD COLUMN IF NOT EXISTS "post_hog_replay_url" varchar',
    )
    expect(FEEDBACK_POSTHOG_REPLAY_UP_SQL).not.toMatch(/UPDATE|DELETE|INSERT/i)
  })

  it('removes only the additive replay columns on rollback', () => {
    expect(FEEDBACK_POSTHOG_REPLAY_DOWN_SQL).toContain(
      'DROP COLUMN IF EXISTS "post_hog_replay_url"',
    )
    expect(FEEDBACK_POSTHOG_REPLAY_DOWN_SQL).toContain(
      'DROP COLUMN IF EXISTS "post_hog_session_id"',
    )
    expect(FEEDBACK_POSTHOG_REPLAY_DOWN_SQL).not.toContain('DROP TABLE')
    const guard = FEEDBACK_POSTHOG_REPLAY_DOWN_SQL.indexOf(
      'Cannot roll back feedback PostHog replay metadata while captured links exist',
    )
    const firstDrop = FEEDBACK_POSTHOG_REPLAY_DOWN_SQL.indexOf('DROP COLUMN')
    expect(guard).toBeGreaterThan(-1)
    expect(firstDrop).toBeGreaterThan(guard)
  })

  it('executes each direction as one bounded migration batch', async () => {
    const upArgs = migrationArgs()
    await up(upArgs.args)
    expect(upArgs.execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
    expect(FEEDBACK_POSTHOG_REPLAY_UP_SQL).toContain("SET LOCAL lock_timeout = '5s'")
  })
})
