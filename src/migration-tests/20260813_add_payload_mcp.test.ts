import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import {
  ADD_PAYLOAD_MCP_DOWN_SQL,
  ADD_PAYLOAD_MCP_UP_SQL,
  down,
  up,
} from '../migrations/20260813_033314_add_payload_mcp'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('Payload MCP migration', () => {
  it('associates keys with users and removes keys when their owner is deleted', async () => {
    const { args, execute } = migrationArgs()

    await up(args)

    expect(execute).toHaveBeenCalledOnce()
    expect(ADD_PAYLOAD_MCP_UP_SQL).toContain('CREATE TABLE "payload_mcp_api_keys"')
    expect(ADD_PAYLOAD_MCP_UP_SQL).toContain('ON DELETE cascade')
  })

  it('removes relationship constraints before dropping the MCP key table', async () => {
    const { args, execute } = migrationArgs()

    await down(args)

    expect(execute).toHaveBeenCalledOnce()
    expect(ADD_PAYLOAD_MCP_DOWN_SQL.indexOf('DROP CONSTRAINT')).toBeLessThan(
      ADD_PAYLOAD_MCP_DOWN_SQL.indexOf('DROP TABLE "payload_mcp_api_keys"'),
    )
    expect(ADD_PAYLOAD_MCP_DOWN_SQL).not.toContain(
      'DROP TABLE "payload_mcp_api_keys" CASCADE',
    )
  })

  it('ships a snapshot matching the owner deletion behavior', () => {
    const snapshot = JSON.parse(
      readFileSync(
        new URL('../migrations/20260813_033314_add_payload_mcp.json', import.meta.url),
        'utf8',
      ),
    ) as {
      tables: Record<
        string,
        {
          foreignKeys: Record<string, { onDelete: string }>
        }
      >
    }

    expect(
      snapshot.tables['public.payload_mcp_api_keys'].foreignKeys[
        'payload_mcp_api_keys_user_id_users_id_fk'
      ].onDelete,
    ).toBe('cascade')
  })
})
