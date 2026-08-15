// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@payloadcms/ui',()=>({useDocumentInfo:()=>({id:7}),useFormFields:(select:(fields:[Record<string,{value:string}>])=>unknown)=>select([{status:{value:'active'}}])}))
import GivingScheduleCancelAction from './GivingScheduleCancelAction'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT:boolean }).IS_REACT_ACT_ENVIRONMENT=true

describe('GivingScheduleCancelAction',()=>{
  let container:HTMLDivElement;let root:Root
  beforeEach(()=>{container=document.createElement('div');document.body.append(container);root=createRoot(container)})
  afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()})
  it('states that cancellation stops future payments without revoking consent and requires two steps',async()=>{
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({nonce:'N'.repeat(43)}),{status:201,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({status:'cancelled'}),{status:200,headers:{'content-type':'application/json'}}))
    vi.stubGlobal('fetch',fetchMock)
    await act(async()=>root.render(<GivingScheduleCancelAction/>))
    expect(container.textContent).toContain('stops future payments')
    expect(container.textContent).toContain('does not revoke')
    const textarea=container.querySelector('textarea')!
    await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')?.set?.call(textarea,'Donor request');textarea.dispatchEvent(new Event('input',{bubbles:true}))})
    await act(async()=>container.querySelector<HTMLButtonElement>('button')?.click())
    expect(container.textContent).toContain('Confirm cancellation')
    await act(async()=>Array.from(container.querySelectorAll('button')).find((button)=>button.textContent==='Confirm cancellation')?.click())
    expect(container.textContent).toContain('consent remains in place')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('does not offer retry when BlinkPay still appears active after an ambiguous DELETE',async()=>{
    vi.stubGlobal('fetch',vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({nonce:'N'.repeat(43)}),{status:201,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({status:'unknown'}),{status:202,headers:{'content-type':'application/json'}})))
    await act(async()=>root.render(<GivingScheduleCancelAction/>))
    const textarea=container.querySelector('textarea')!
    await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')?.set?.call(textarea,'Donor request');textarea.dispatchEvent(new Event('input',{bubbles:true}))})
    await act(async()=>container.querySelector<HTMLButtonElement>('button')?.click())
    await act(async()=>Array.from(container.querySelectorAll('button')).find((button)=>button.textContent==='Confirm cancellation')?.click())
    expect(container.textContent).toContain('still unknown')
    expect(container.textContent).toContain('currently shows active')
    expect(container.textContent).toContain('do not submit it again')
    expect(container.querySelector('button')).toBeNull()
  })
})
