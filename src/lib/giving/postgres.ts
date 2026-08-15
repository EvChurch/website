import type { Pool } from 'pg'
import type { Payload } from 'payload'

export function requireGivingPostgresPool(payload: Pick<Payload, 'db'>): Pool {
  const pool = (payload.db as unknown as { pool?: Partial<Pool> }).pool
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function') {
    throw new Error('Giving requires Payload PostgreSQL')
  }
  return pool as Pool
}
