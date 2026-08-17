import { describe, expect, it, vi } from 'vitest'

import { requireGivingPostgresPool } from './postgres'

describe('giving Payload PostgreSQL ownership', () => {
  it('returns Payload’s owned pool unchanged', () => {
    const pool = { query: vi.fn(), connect: vi.fn() }
    expect(requireGivingPostgresPool({ db: { pool } } as never)).toBe(pool)
  })

  it.each([{}, { pool: {} }, { pool: { query: vi.fn() } }])('fails closed for a missing or malformed pool', (db) => {
    expect(() => requireGivingPostgresPool({ db } as never)).toThrow(/Payload PostgreSQL/u)
  })
})
