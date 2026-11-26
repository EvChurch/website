import type { Pool } from 'pg'
import type { Payload } from 'payload'

export function coursePostgresPool(payload: Pick<Payload, 'db'>): Pool {
  const pool = (payload.db as unknown as { pool?: Partial<Pool> }).pool
  if (!pool || typeof pool.query !== 'function') throw new Error('Courses require Payload PostgreSQL')
  return pool as Pool
}
