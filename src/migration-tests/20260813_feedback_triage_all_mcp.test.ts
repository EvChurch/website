import { describe, expect, it, vi } from 'vitest'

import {
  FEEDBACK_TRIAGE_ALL_MCP_DOWN_SQL,
  FEEDBACK_TRIAGE_ALL_MCP_UP_SQL,
  MCP_PERMISSION_FIELDS,
  down,
  up,
} from '../migrations/20260813_120000_feedback_triage_all_mcp'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('feedback triage and all-content MCP migration', () => {
  it('adds a default New resolution state without replacing feedback rows', () => {
    expect(FEEDBACK_TRIAGE_ALL_MCP_UP_SQL).toContain(
      'enum_feedback_submissions_resolution_status',
    )
    expect(FEEDBACK_TRIAGE_ALL_MCP_UP_SQL).toContain(
      'NOT NULL DEFAULT \'new\'',
    )
    expect(FEEDBACK_TRIAGE_ALL_MCP_UP_SQL).not.toMatch(
      /DELETE\s+FROM\s+"feedback_submissions"/i,
    )
  })

  it('makes email required while explicitly marking legacy rows with no address', () => {
    expect(FEEDBACK_TRIAGE_ALL_MCP_UP_SQL).toContain('@legacy.invalid')
    expect(FEEDBACK_TRIAGE_ALL_MCP_UP_SQL).toContain(
      'ALTER COLUMN "email" SET NOT NULL',
    )
  })

  it('adds a disabled-by-default permission for every newly exposed MCP capability', () => {
    expect(MCP_PERMISSION_FIELDS).toContain('feedback_submissions_find')
    expect(MCP_PERMISSION_FIELDS).toContain('feedback_submissions_update')
    expect(MCP_PERMISSION_FIELDS).toContain('navigation_find')
    for (const field of MCP_PERMISSION_FIELDS) {
      expect(FEEDBACK_TRIAGE_ALL_MCP_UP_SQL).toContain(
        `ADD COLUMN IF NOT EXISTS "${field}" boolean DEFAULT false`,
      )
      expect(FEEDBACK_TRIAGE_ALL_MCP_DOWN_SQL).toContain(
        `DROP COLUMN IF EXISTS "${field}"`,
      )
    }
    for (const existingPagePermission of [
      'pages_find',
      'pages_create',
      'pages_update',
      'pages_delete',
    ]) {
      expect(MCP_PERMISSION_FIELDS).not.toContain(existingPagePermission)
      expect(FEEDBACK_TRIAGE_ALL_MCP_DOWN_SQL).not.toContain(
        `DROP COLUMN IF EXISTS "${existingPagePermission}"`,
      )
    }
  })

  it('allows existing active MCP keys to triage feedback without broad mutation access', () => {
    expect(FEEDBACK_TRIAGE_ALL_MCP_UP_SQL).toMatch(
      /SET "feedback_submissions_find" = true,\s+"feedback_submissions_update" = true\s+WHERE "enable_a_p_i_key" = true/,
    )
    expect(FEEDBACK_TRIAGE_ALL_MCP_UP_SQL).not.toMatch(
      /SET[\s\S]*"feedback_submissions_(?:create|delete)" = true/,
    )
  })

  it('runs one atomic SQL batch in each direction', async () => {
    const upArgs = migrationArgs()
    await up(upArgs.args)
    expect(upArgs.execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
  })
})
