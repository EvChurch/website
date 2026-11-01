import type { Pool, PoolClient } from 'pg'
export async function apiPool(): Promise<Pool> {
  const {getPayloadClient} = await import('@/lib/payload')
  const payload = await getPayloadClient()
  const pool = (payload.db as unknown as {pool?: Pool}).pool
  if (!pool?.connect) throw new Error('The API requires PostgreSQL')
  return pool
}
export async function transaction<T>(pool: Pool, operation: (db: PoolClient) => Promise<T>) {
  const db = await pool.connect()
  try { await db.query('BEGIN'); const result = await operation(db); await db.query('COMMIT'); return result }
  catch (error) { await db.query('ROLLBACK'); throw error }
  finally { db.release() }
}
