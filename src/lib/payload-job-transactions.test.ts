import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

// Exercise Payload's installed helper so an upstream change or missing package
// patch cannot silently reintroduce the connection leak.
const require = createRequire(import.meta.url)
const helperUrl = pathToFileURL(join(
  dirname(require.resolve('payload')),
  'queues/utilities/updateJob.js',
)).href

interface JobDatabase {
  name: string
  beginTransaction(): Promise<string>
  updateJobs(): Promise<unknown[]>
  commitTransaction(id: string): Promise<void>
  rollbackTransaction(id: string): Promise<void>
}

const { updateJobs } = await import(helperUrl) as {
  updateJobs(args: {
    id: number
    data: { log: { $push: { state: string } } }
    req: { payload: { db: JobDatabase; config: { jobs: object } } }
  }): Promise<unknown>
}

function fixture() {
  let sequence = 0
  const openTransactions = new Set<string>()
  const db = {
    name: 'postgres',
    beginTransaction: vi.fn(async () => {
      const id = String(++sequence)
      openTransactions.add(id)
      return id
    }),
    updateJobs: vi.fn(async (): Promise<unknown[]> => []),
    commitTransaction: vi.fn(async (id: string) => { openTransactions.delete(id) }),
    rollbackTransaction: vi.fn(async (id: string) => { openTransactions.delete(id) }),
  }
  const update = () => updateJobs({
    id: 1,
    data: { log: { $push: { state: 'succeeded' } } },
    req: { payload: { db, config: { jobs: {} } } },
  })
  return { db, openTransactions, update }
}

describe('Payload job transaction cleanup', () => {
  it('releases every transaction when job log writes repeatedly fail', async () => {
    const { db, openTransactions, update } = fixture()
    const failure = Object.assign(new Error('Job log parent no longer exists'), { code: '23503' })
    db.updateJobs.mockRejectedValue(failure)

    // More failures than the default ten-connection pool can accommodate.
    for (let i = 0; i < 12; i++) {
      await expect(update()).rejects.toBe(failure)
      expect(openTransactions.size).toBe(0)
    }
    expect(db.rollbackTransaction).toHaveBeenCalledTimes(12)
    expect(db.commitTransaction).not.toHaveBeenCalled()
  })

  it('rolls back and preserves the original error when commit fails', async () => {
    const { db, openTransactions, update } = fixture()
    const failure = new Error('Synthetic commit failure')
    db.commitTransaction.mockRejectedValue(failure)

    await expect(update()).rejects.toBe(failure)
    expect(db.rollbackTransaction).toHaveBeenCalledExactlyOnceWith('1')
    expect(openTransactions.size).toBe(0)
  })

  it('commits successful updates without rolling back', async () => {
    const { db, openTransactions, update } = fixture()
    await update()
    expect(db.commitTransaction).toHaveBeenCalledExactlyOnceWith('1')
    expect(db.rollbackTransaction).not.toHaveBeenCalled()
    expect(openTransactions.size).toBe(0)
  })
})
