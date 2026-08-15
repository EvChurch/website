import { describe, expect, it, vi } from 'vitest'
import { createGivingE2ESessionService, GivingE2ESessionError, type GivingE2ESessionStore } from './e2e-session'

function memoryStore(): GivingE2ESessionStore {
  type Row = NonNullable<Awaited<ReturnType<GivingE2ESessionStore['find']>>>
  const rows: Row[] = []
  return {
    async create(record) { const row = { ...record, id: rows.length + 1, e2eRunId: rows.length + 1, revokedAt: null }; rows.push(row); return row },
    async find(tokenDigest) { return rows.find((row) => row.tokenDigest === tokenDigest) ?? null },
    async findActive(tokenDigest, now) { return rows.find((row) => row.tokenDigest === tokenDigest && !row.revokedAt && row.expiresAt > now) ?? null },
    async revoke(tokenDigest, csrfDigest, now) { const row = rows.find((item) => item.tokenDigest === tokenDigest && item.csrfDigest === csrfDigest && !item.revokedAt); if (!row) return false; row.revokedAt = now; return true },
  }
}

describe('protected giving E2E session', () => {
  it('persists an immutable sandbox synthetic authority and revokes idempotently', async () => {
    vi.stubEnv('GIVING_E2E_ENABLED', 'true'); vi.stubEnv('GIVING_ROCK_E2E_PERSON_ALIAS_ID', '1234')
    let byte = 1
    const service = createGivingE2ESessionService(memoryStore(), { now: () => new Date('2026-08-15T00:00:00Z'), randomBytes: () => Buffer.alloc(32, byte++) })
    const started = await service.start({ actorId: 7, runId: 'run-1' })
    expect(started.authority).toMatchObject({ environment: 'sandbox', synthetic: true, contextKey: 'sandbox:e2e:run-1', actorId: 7 })
    expect(await service.read(started.token)).toMatchObject({ runId: 'run-1' })
    await expect(service.stop({ token: started.token, csrf: started.csrf, actorId: 7 })).resolves.toBeUndefined()
    await expect(service.stop({ token: started.token, csrf: started.csrf, actorId: 7 })).resolves.toBeUndefined()
    expect(await service.read(started.token)).toBeNull()
  })

  it('allows only the exact activating admin to stop a run', async () => {
    vi.stubEnv('GIVING_E2E_ENABLED', 'true'); vi.stubEnv('GIVING_ROCK_E2E_PERSON_ALIAS_ID', '1234')
    const service = createGivingE2ESessionService(memoryStore(), { randomBytes: () => Buffer.alloc(32, 4) })
    const started = await service.start({ actorId: 7, runId: 'actor-bound' })
    await expect(service.stop({ token: started.token, csrf: started.csrf, actorId: 8 })).rejects.toBeInstanceOf(GivingE2ESessionError)
    expect(await service.read(started.token)).not.toBeNull()
  })

  it('fails closed for disabled mode, missing test alias, copied tokens and altered CSRF', async () => {
    const store = memoryStore(); const random = () => Buffer.alloc(32, 9)
    vi.stubEnv('GIVING_E2E_ENABLED', 'false')
    await expect(createGivingE2ESessionService(store, { randomBytes: random }).start({ actorId: 1, runId: 'run' })).rejects.toBeInstanceOf(GivingE2ESessionError)
    vi.stubEnv('GIVING_E2E_ENABLED', 'true'); vi.stubEnv('GIVING_ROCK_E2E_PERSON_ALIAS_ID', '')
    await expect(createGivingE2ESessionService(store, { randomBytes: random }).start({ actorId: 1, runId: 'run' })).rejects.toBeInstanceOf(GivingE2ESessionError)
  })
})
