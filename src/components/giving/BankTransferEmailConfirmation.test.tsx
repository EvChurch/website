// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'

import { BankTransferEmailConfirmation } from './BankTransferEmailConfirmation'

;(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true

describe('BankTransferEmailConfirmation',()=>{
  const container=document.createElement('div');const root=createRoot(container)
  beforeEach(()=>{document.body.appendChild(container);vi.stubGlobal('fetch',vi.fn())})
  afterEach(async()=>{await act(async()=>root.render(<></>));container.remove();vi.unstubAllGlobals()})

  it('requires a final POST and celebrates only an accepted setup acknowledgement',async()=>{
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({acknowledged:true,verified:false}),{status:200,headers:{'content-type':'application/json'}}))
    await act(async()=>root.render(<BankTransferEmailConfirmation token="signed-token"/>))
    expect(container.textContent).toContain('does not verify that a payment has reached Ev')
    await act(async()=>Array.from(container.querySelectorAll('button')).find((button)=>button.textContent?.includes("I've set this up"))?.click())
    expect(fetch).toHaveBeenCalledWith('/api/giving/bank-transfer/acknowledge-email',expect.objectContaining({method:'POST'}))
    expect(container.textContent).toContain('Ev hasn’t verified a payment yet')
    expect(container.textContent).toContain('2 Corinthians 9:7')
  })
})
