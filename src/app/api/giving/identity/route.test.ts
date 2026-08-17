import { describe,expect,it,vi } from 'vitest'

import { handleGivingIdentityGet } from './route'

describe('GET giving identity', () => {
  it('returns only private prefill fields for the current signed-in member', async () => {
    const response=await handleGivingIdentityGet({resolve:vi.fn(async()=>({signedIn:true,personId:42,personAliasId:84,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com',missingFields:[]}))})
    expect(await response.json()).toEqual({signedIn:true,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'})
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
  })

  it('returns signed-out without identifiers and sanitizes provider failure', async () => {
    const signedOut=await handleGivingIdentityGet({resolve:vi.fn(async()=>({signedIn:false as const}))})
    expect(await signedOut.json()).toEqual({signedIn:false})
    const failed=await handleGivingIdentityGet({resolve:vi.fn(async()=>{throw new Error('private')})})
    expect(failed.status).toBe(503)
    expect(JSON.stringify(await failed.json())).not.toContain('private')
  })
})
