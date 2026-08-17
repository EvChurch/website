import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import {
  GivingIdentityResolutionError,
  bankReferenceForAlias,
  normaliseGivingEmail,
  resolveGivingIdentity,
} from './rock-identity'

const context = { contextKey: 'production', environment: 'production' as const, synthetic: false }
const person = (id: number, alias: number, email: string | null = 'ada@example.com') => ({
  id, primaryAliasId: alias, guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d', firstName: 'Different', lastName: 'Name', email,
})
const fingerprintSecret = 'x'.repeat(32)
function createOperationDigest(email: string, guid: string, contextKey = 'production', checkoutId = 10) {
  const fingerprint = createHmac('sha256', fingerprintSecret).update(email).digest('hex')
  return createHash('sha256').update([contextKey, String(checkoutId), guid, fingerprint].join(':')).digest('hex')
}

function repository(operation: { id: number; status: 'prepared' | 'submitted' | 'unknown' | 'succeeded'; providerId: string | null; correlationKey?: string; requestDigest?: string } = { id: 1, status: 'prepared', providerId: null }) {
  return {
    withFingerprintLock: vi.fn(async (_fingerprint: string, work: () => Promise<unknown>) => work()),
    findOperation: vi.fn().mockResolvedValue(null),
    prepareOperation: vi.fn().mockImplementation(async (input) => ({ ...operation, correlationKey: operation.correlationKey ?? input.correlationKey, requestDigest: operation.requestDigest ?? input.requestDigest })),
    markSubmitted: vi.fn().mockResolvedValue(undefined),
    markUnknown: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    commitSuccess: vi.fn().mockResolvedValue(501),
  }
}

describe('giving Rock identity', () => {
  it('validates and Unicode-normalises email before exact matching', () => {
    expect(normaliseGivingEmail('  ADA@ExAmPlE.com  ')).toBe('ada@example.com')
    expect(normaliseGivingEmail('Jose\u0301@example.com')).toBe('josé@example.com')
    expect(() => normaliseGivingEmail('ada\n@example.com')).toThrow(/email/i)
    expect(() => normaliseGivingEmail('not-an-email')).toThrow(/email/i)
  })

  it('reuses exactly one active exact email result without consulting its name', async () => {
    const repo = repository()
    const rockClient = {
      findActivePeopleByEmail: vi.fn().mockResolvedValue([
        person(42, 84, ' ADA@example.com '),
        person(43, 85, 'other@example.com'),
      ]),
      getPersonByAlias: vi.fn().mockResolvedValue(person(42, 84)),
      createPerson: vi.fn(),
      findPersonByGuid: vi.fn(),
    }

    await expect(resolveGivingIdentity({
      ...context, checkoutId: 10, identity: { kind: 'guest', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    }, { rockClient: rockClient as never, repository: repo as never, fingerprintSecret: 'x'.repeat(32) })).resolves.toMatchObject({
      giverId: 501, personAliasId: 84, bankReference: 'EV84', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com',
    })
    expect(rockClient.createPerson).not.toHaveBeenCalled()
  })

  it('binds a local synthetic identity without reading or mutating Rock', async () => {
    const repo = repository()
    const rockClient = {
      findActivePeopleByEmail: vi.fn(),
      createPerson: vi.fn(),
      findPersonByGuid: vi.fn(),
      getPersonByAlias: vi.fn(),
    }

    await expect(resolveGivingIdentity({
      contextKey: 'sandbox', environment: 'sandbox', synthetic: true, checkoutId: 10,
      identity: { kind: 'guest', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    }, { rockClient: rockClient as never, repository: repo as never, fingerprintSecret })).resolves.toMatchObject({
      giverId: 501, personAliasId: 10, bankReference: 'EV10',
    })
    expect(rockClient.findActivePeopleByEmail).not.toHaveBeenCalled()
    expect(rockClient.createPerson).not.toHaveBeenCalled()
    expect(rockClient.findPersonByGuid).not.toHaveBeenCalled()
    expect(rockClient.getPersonByAlias).not.toHaveBeenCalled()
  })

  it.each([[[]], [[person(42, 84), person(43, 85)]]])('creates for zero or multiple exact matches', async (matches) => {
    const repo = repository()
    const rockClient = {
      findActivePeopleByEmail: vi.fn().mockResolvedValue(matches),
      createPerson: vi.fn().mockResolvedValue(person(99, 199)),
      findPersonByGuid: vi.fn(),
      getPersonByAlias: vi.fn(),
    }
    const result = await resolveGivingIdentity({
      ...context, checkoutId: 10, identity: { kind: 'guest', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    }, { rockClient: rockClient as never, repository: repo as never, fingerprintSecret: 'x'.repeat(32), createGuid: () => '22e31fd2-e649-43d5-b350-8a620f68ca1d' })

    expect(result.personAliasId).toBe(199)
    expect(rockClient.createPerson).toHaveBeenCalledOnce()
    expect(repo.markSubmitted).toHaveBeenCalledBefore(repo.commitSuccess)
  })

  it('recovers a timed-out committed create by GUID without issuing a second create', async () => {
    const repo = repository()
    const unknown = Object.assign(new Error('sanitised'), { outcome: 'unknown' as const })
    const rockClient = {
      findActivePeopleByEmail: vi.fn().mockResolvedValue([]),
      createPerson: vi.fn().mockRejectedValue(unknown),
      findPersonByGuid: vi.fn().mockResolvedValue(person(99, 199)),
      getPersonByAlias: vi.fn(),
    }

    await expect(resolveGivingIdentity({
      ...context, checkoutId: 10, identity: { kind: 'guest', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    }, { rockClient: rockClient as never, repository: repo as never, fingerprintSecret: 'x'.repeat(32), createGuid: () => '22e31fd2-e649-43d5-b350-8a620f68ca1d' })).resolves.toMatchObject({ personAliasId: 199 })
    expect(repo.markUnknown).toHaveBeenCalledOnce()
    expect(rockClient.createPerson).toHaveBeenCalledOnce()
  })

  it('resumes a prepared create with its persisted GUID', async () => {
    const repo = repository()
    repo.findOperation.mockResolvedValue({
      id: 1, status: 'prepared', providerId: null, correlationKey: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
      requestDigest: createOperationDigest('ada@example.com', '22e31fd2-e649-43d5-b350-8a620f68ca1d'),
    })
    const rockClient = {
      findActivePeopleByEmail: vi.fn(),
      createPerson: vi.fn().mockResolvedValue(person(99, 199)),
      findPersonByGuid: vi.fn(),
      getPersonByAlias: vi.fn(),
    }
    await resolveGivingIdentity({
      ...context, checkoutId: 10, identity: { kind: 'guest', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    }, { rockClient: rockClient as never, repository: repo as never, fingerprintSecret: 'x'.repeat(32), createGuid: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })

    expect(rockClient.createPerson).toHaveBeenCalledWith(expect.objectContaining({
      guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
    }))
    expect(rockClient.findActivePeopleByEmail).not.toHaveBeenCalled()
  })

  it('leaves an unrecovered ambiguous create unknown and blocks a blind retry', async () => {
    const repo = repository()
    repo.findOperation.mockResolvedValue({
      id: 1, status: 'unknown', providerId: null, correlationKey: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
      requestDigest: createOperationDigest('ada@example.com', '22e31fd2-e649-43d5-b350-8a620f68ca1d'),
    })
    const rockClient = {
      findActivePeopleByEmail: vi.fn(), createPerson: vi.fn(), findPersonByGuid: vi.fn().mockResolvedValue(null), getPersonByAlias: vi.fn(),
    }
    await expect(resolveGivingIdentity({
      ...context, checkoutId: 10, identity: { kind: 'guest', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    }, { rockClient: rockClient as never, repository: repo as never, fingerprintSecret: 'x'.repeat(32), createGuid: () => '22e31fd2-e649-43d5-b350-8a620f68ca1d' })).rejects.toMatchObject({ code: 'identity-unknown' })
    expect(rockClient.createPerson).not.toHaveBeenCalled()
  })

  it('rejects replaying a prepared checkout with a different email before provider access or binding', async () => {
    const repo = repository()
    repo.findOperation.mockResolvedValue({
      id: 1,
      status: 'prepared',
      providerId: null,
      correlationKey: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
      requestDigest: createOperationDigest('original@example.com', '22e31fd2-e649-43d5-b350-8a620f68ca1d'),
    })
    const rockClient = {
      findActivePeopleByEmail: vi.fn(), createPerson: vi.fn(), findPersonByGuid: vi.fn(), getPersonByAlias: vi.fn(),
    }

    await expect(resolveGivingIdentity({
      ...context, checkoutId: 10, identity: { kind: 'guest', firstName: 'Ada', lastName: 'Lovelace', email: 'changed@example.com' },
    }, { rockClient: rockClient as never, repository: repo as never, fingerprintSecret })).rejects.toMatchObject({ code: 'identity-invalid' })
    expect(rockClient.createPerson).not.toHaveBeenCalled()
    expect(rockClient.findPersonByGuid).not.toHaveBeenCalled()
    expect(repo.commitSuccess).not.toHaveBeenCalled()
  })

  it('re-resolves stored aliases after a merge without coalescing local histories', async () => {
    const repo = repository()
    const rockClient = {
      findActivePeopleByEmail: vi.fn(), createPerson: vi.fn(), findPersonByGuid: vi.fn(), getPersonByAlias: vi.fn().mockResolvedValue(person(77, 999)),
    }
    const result = await resolveGivingIdentity({
      ...context, checkoutId: 10, identity: { kind: 'member', personAliasId: 84, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    }, { rockClient: rockClient as never, repository: repo as never, fingerprintSecret: 'x'.repeat(32) })
    expect(result.personAliasId).toBe(84)
    expect(repo.commitSuccess).toHaveBeenCalledWith(expect.objectContaining({ rockPersonAliasId: 84 }))
  })

  it('serializes simultaneous identical submissions and creates at most one Rock person', async () => {
    let tail = Promise.resolve()
    let operation: { id: number; status: 'prepared' | 'submitted' | 'succeeded'; providerId: string | null; correlationKey: string; requestDigest: string } | null = null
    const repo = {
      withFingerprintLock: vi.fn(async (_fingerprint: string, work: () => Promise<unknown>) => {
        const previous = tail
        let release = () => {}
        tail = new Promise<void>((resolve) => { release = resolve })
        await previous
        try { return await work() } finally { release() }
      }),
      findOperation: vi.fn(async () => operation),
      prepareOperation: vi.fn(async (input) => {
        operation ??= { id: 1, status: 'prepared', providerId: null, correlationKey: input.correlationKey, requestDigest: input.requestDigest }
        return { ...operation }
      }),
      markSubmitted: vi.fn(async () => { if (operation) operation.status = 'submitted' }),
      markUnknown: vi.fn(),
      markFailed: vi.fn(),
      commitSuccess: vi.fn(async (input) => {
        if (operation) {
          operation.status = 'succeeded'
          operation.providerId = String(input.rockPersonAliasId)
        }
        return 501
      }),
    }
    const rockClient = {
      findActivePeopleByEmail: vi.fn().mockResolvedValue([]),
      createPerson: vi.fn().mockResolvedValue(person(99, 199)),
      findPersonByGuid: vi.fn(),
      getPersonByAlias: vi.fn().mockResolvedValue(person(99, 199)),
    }
    const request = {
      ...context, checkoutId: 10, identity: { kind: 'guest' as const, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    }
    await Promise.all([
      resolveGivingIdentity(request, { rockClient: rockClient as never, repository: repo as never, fingerprintSecret: 'x'.repeat(32), createGuid: () => '22e31fd2-e649-43d5-b350-8a620f68ca1d' }),
      resolveGivingIdentity(request, { rockClient: rockClient as never, repository: repo as never, fingerprintSecret: 'x'.repeat(32), createGuid: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    ])
    expect(rockClient.createPerson).toHaveBeenCalledOnce()
  })

  it('rejects aliases that do not fit instead of truncating', () => {
    expect(bankReferenceForAlias(42)).toBe('EV42')
    expect(() => bankReferenceForAlias(12_345_678_901)).toThrow(/12 characters/i)
    expect(() => bankReferenceForAlias(0)).toThrow(/alias/i)
  })

  it('ignores browser identity fields because its input schema has no browser alias or reference', async () => {
    const error = new GivingIdentityResolutionError('identity-invalid')
    expect(error.message).not.toContain('@')
  })
})
