import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  AUTH0_ADMIN_SSO_DOWN_SQL,
  AUTH0_ADMIN_SSO_UP_SQL,
  down,
  up,
} from '../migrations/20260806_auth0_admin_sso'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('Auth0 admin SSO migration', () => {
  it('ships a schema snapshot without local credential storage', () => {
    const snapshot = JSON.parse(
      readFileSync(new URL('../migrations/20260806_auth0_admin_sso.json', import.meta.url), 'utf8'),
    ) as { tables: Record<string, { columns: Record<string, unknown> }> }
    expect(snapshot.tables['public.users'].columns).toHaveProperty(
      'auth0_identity_key',
    )
    expect(snapshot.tables['public.users'].columns).not.toHaveProperty('hash')
    expect(snapshot.tables).not.toHaveProperty('public.users_sessions')
  })

  it('refuses to mix disposable local users with Auth0 identities', () => {
    expect(AUTH0_ADMIN_SSO_UP_SQL).toContain('existing Payload users')
    expect(AUTH0_ADMIN_SSO_UP_SQL).toContain('RAISE EXCEPTION')
  })

  it('adds immutable identity columns and unique constraints', () => {
    expect(AUTH0_ADMIN_SSO_UP_SQL).toContain('auth0_identity_key')
    expect(AUTH0_ADMIN_SSO_UP_SQL).toContain('auth0_issuer')
    expect(AUTH0_ADMIN_SSO_UP_SQL).toContain('auth0_subject')
    expect(AUTH0_ADMIN_SSO_UP_SQL).toContain('users_auth0_identity_key_idx')
    expect(AUTH0_ADMIN_SSO_UP_SQL).toContain('users_roles_parent_value_unique')
  })

  it('removes local credential storage without deleting email', () => {
    expect(AUTH0_ADMIN_SSO_UP_SQL).toContain('DROP COLUMN IF EXISTS "hash"')
    expect(AUTH0_ADMIN_SSO_UP_SQL).not.toContain('DROP COLUMN IF EXISTS "email"')
    expect(AUTH0_ADMIN_SSO_DOWN_SQL).toContain('ADD COLUMN IF NOT EXISTS "hash"')
  })

  it('executes atomic up and down batches', async () => {
    const upArgs = migrationArgs()
    await up(upArgs.args)
    expect(upArgs.execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
  })
})
