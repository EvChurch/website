import { describe, expect, it, vi } from 'vitest'

import {
  FIX_ROCK_FORMS_MCP_PERMISSIONS_DOWN_SQL,
  FIX_ROCK_FORMS_MCP_PERMISSIONS_UP_SQL,
  ROCK_FORMS_MCP_PERMISSION_FIELDS,
  down,
  up,
} from '../migrations/20260820_150000_fix_rock_forms_mcp_permissions'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('Rock Forms MCP permission repair', () => {
  it('adds every Rock Forms permission disabled by default', () => {
    for (const field of ROCK_FORMS_MCP_PERMISSION_FIELDS) {
      expect(FIX_ROCK_FORMS_MCP_PERMISSIONS_UP_SQL).toContain(
        `ADD COLUMN IF NOT EXISTS "${field}" boolean DEFAULT false`,
      )
    }
  })

  it('removes only the Rock Forms permission columns on rollback', () => {
    for (const field of ROCK_FORMS_MCP_PERMISSION_FIELDS) {
      expect(FIX_ROCK_FORMS_MCP_PERMISSIONS_DOWN_SQL).toContain(
        `DROP COLUMN IF EXISTS "${field}"`,
      )
    }
    expect(FIX_ROCK_FORMS_MCP_PERMISSIONS_DOWN_SQL).not.toContain(
      'DROP TABLE "payload_mcp_api_keys"',
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
