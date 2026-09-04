import { describe, expect, it, vi } from 'vitest'

import { migrations } from '../migrations'
import {
  FEEDBACK_GITHUB_ISSUE_LINKS_DOWN_SQL,
  FEEDBACK_GITHUB_ISSUE_LINKS_UP_SQL,
  down,
  up,
} from '../migrations/20260905_060000_feedback_github_issue_links'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('feedback GitHub issue links migration', () => {
  it('registers after the existing migrations', () => {
    expect(migrations.at(-1)?.name).toBe('20260905_060000_feedback_github_issue_links')
  })

  it('adds nullable GitHub issue tracking fields', () => {
    expect(FEEDBACK_GITHUB_ISSUE_LINKS_UP_SQL).toContain('"github_issue_number"')
    expect(FEEDBACK_GITHUB_ISSUE_LINKS_UP_SQL).toContain('"github_issue_url"')
    expect(FEEDBACK_GITHUB_ISSUE_LINKS_UP_SQL).toContain(
      '"feedback_submissions_github_issue_number_idx"',
    )
  })

  it('is additive, bounded, and reversible', () => {
    expect(FEEDBACK_GITHUB_ISSUE_LINKS_UP_SQL).toContain("lock_timeout = '5s'")
    expect(FEEDBACK_GITHUB_ISSUE_LINKS_UP_SQL).toContain("statement_timeout = '30s'")
    expect(FEEDBACK_GITHUB_ISSUE_LINKS_UP_SQL).toContain('ADD COLUMN IF NOT EXISTS')
    expect(FEEDBACK_GITHUB_ISSUE_LINKS_DOWN_SQL).toContain('DROP COLUMN IF EXISTS')
    expect(FEEDBACK_GITHUB_ISSUE_LINKS_UP_SQL).not.toMatch(/DELETE\s+FROM/i)
  })

  it('runs one SQL batch in each direction', async () => {
    const upArgs = migrationArgs()
    await up(upArgs.args)
    expect(upArgs.execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
  })
})
