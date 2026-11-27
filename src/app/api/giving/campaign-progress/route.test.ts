import { expect, it } from 'vitest'
import { handleCampaignProgressGet } from './route'

it('publishes only the five aggregate confirmed receipt totals without authentication or caching',async()=>{
  const receipts={plant:0,train:50000,grow:250000,build:250000,'greatest-need':0}
  const response=await handleCampaignProgressGet(async()=>receipts)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({receipts})
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('set-cookie')).toBeNull()
})
it.each([
  {plant:0,train:0,grow:0,build:-1,'greatest-need':0},
  {plant:0,train:0,grow:0,build:0,'greatest-need':0,donor:'Private donor'},
])('does not publish malformed totals or extra fields',async receipts=>{
  const response=await handleCampaignProgressGet(async()=>receipts)
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({error:'Campaign totals unavailable'})
})
it('reports unavailability instead of inventing zero receipts when the ledger is unavailable',async()=>{
  const response=await handleCampaignProgressGet(async()=>{throw new Error('private connection details')})
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('private connection')
})
