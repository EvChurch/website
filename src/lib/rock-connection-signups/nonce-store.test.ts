import { describe, expect, it } from 'vitest'

import { createMemoryNonceStore, digestConnectionNonce } from './nonce-store'

describe('Rock Connection nonce store', () => {
  it('allows exactly one concurrent consumer and rejects replay', async () => {
    const store = createMemoryNonceStore()
    const record = {
      nonceDigest: digestConnectionNonce('nonce'),
      purpose: 'rock-connection-signup',
      pageGuid: 'page',
      blockGuid: 'block',
      expiresAt: new Date(Date.now() + 60_000),
    }
    await store.create(record)
    const results = await Promise.all([store.consume(record), store.consume(record)])
    expect(results.sort()).toEqual([false, true])
    await expect(store.consume(record)).resolves.toBe(false)
  })

  it('fails closed on a missing or expired nonce', async () => {
    const store = createMemoryNonceStore()
    const record = {
      nonceDigest: digestConnectionNonce('nonce'),
      purpose: 'rock-connection-signup',
      pageGuid: 'page',
      blockGuid: 'block',
      expiresAt: new Date(Date.now() - 1),
    }
    await store.create(record)
    await expect(store.consume(record)).resolves.toBe(false)
  })
})
