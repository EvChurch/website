import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { handleGivingScheduleCancel } from './route'

function request(body: unknown, headers: Record<string,string> = {}) {
  return new NextRequest('https://www.ev.church/api/admin/giving/schedules/7/cancel',{method:'POST',headers:{origin:'https://www.ev.church','sec-fetch-site':'same-origin','content-type':'application/json','x-ev-giving-admin-request':'cancel-schedule-v1',...headers},body:JSON.stringify(body)})
}
const context = { params:Promise.resolve({ id:'7' }) }

describe('admin giving schedule cancellation route', () => {
  it('reauthenticates exact admin and performs prepare then confirm', async () => {
    const deps = { admin:vi.fn(async()=>11),cancel:vi.fn(async(input:{phase:string})=>input.phase==='prepare'?{nonce:'N'.repeat(43),expiresAt:'2026-08-15T00:05:00Z'}:{status:'cancelled' as const}) }
    expect((await handleGivingScheduleCancel(request({phase:'prepare',reason:'Donor request'}),context,deps)).status).toBe(201)
    expect((await handleGivingScheduleCancel(request({phase:'confirm',reason:'Donor request',nonce:'N'.repeat(43)}),context,deps)).status).toBe(200)
    expect(deps.admin).toHaveBeenCalledTimes(2)
    expect(deps.cancel).toHaveBeenLastCalledWith({actorId:11,scheduleId:7,phase:'confirm',reason:'Donor request',nonce:'N'.repeat(43)})
  })

  it.each<Record<string,string>>([
    { origin:'https://evil.test' },
    { 'sec-fetch-site':'cross-site' },
    { 'x-ev-giving-admin-request':'copied' },
  ])('fails untrusted requests before auth or provider work', async (headers) => {
    const deps = { admin:vi.fn(async()=>11),cancel:vi.fn() }
    expect((await handleGivingScheduleCancel(request({phase:'prepare',reason:'Donor request'},headers),context,deps)).status).toBe(404)
    expect(deps.admin).not.toHaveBeenCalled();expect(deps.cancel).not.toHaveBeenCalled()
  })

  it('fails non-admin, malformed, oversized and mass-assigned requests before cancellation', async () => {
    const denied = { admin:vi.fn(async()=>null),cancel:vi.fn() }
    expect((await handleGivingScheduleCancel(request({phase:'prepare',reason:'Donor request'}),context,denied)).status).toBe(404)
    expect(denied.cancel).not.toHaveBeenCalled()
    const deps = { admin:vi.fn(async()=>11),cancel:vi.fn() }
    expect((await handleGivingScheduleCancel(request({phase:'confirm',reason:'Donor request',nonce:'N'.repeat(43),environment:'production'}),context,deps)).status).toBe(400)
    expect((await handleGivingScheduleCancel(request({phase:'prepare',reason:'x'.repeat(2000)},{'content-length':'2000'}),context,deps)).status).toBe(409)
    expect(deps.cancel).not.toHaveBeenCalled()
  })

  it('reports ambiguous results without claiming cancellation', async () => {
    const deps = { admin:vi.fn(async()=>11),cancel:vi.fn(async()=>({status:'unknown' as const})) }
    const result = await handleGivingScheduleCancel(request({phase:'confirm',reason:'Donor request',nonce:'N'.repeat(43)}),context,deps)
    expect(result.status).toBe(202);expect(await result.json()).toEqual({status:'unknown'})
  })
})
