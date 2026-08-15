// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicGivingFund } from '@/lib/giving/contracts'
import { GIVING_STATUS_POLL_LIMIT, GivingFlow, givingCheckoutPresentation, givingStatusPollDelay, safeGivingGatewayRedirect } from './GivingFlow'

vi.mock('@/components/forms/TurnstileWidget', () => ({ TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => <button type="button" data-turnstile onClick={() => onToken('turnstile-token')}>Pass security check</button> }))
const trackGivingEvent=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/giving/analytics',()=>({trackGivingEvent}))
vi.mock('./GivingExperienceProvider',()=>({useGivingExperience:()=>({givingViewActive:true,registerGivingBackHandler:()=>()=>undefined})}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const funds: PublicGivingFund[] = [
  { id: 1, name: 'Missions', code: 'MISSIONS', sortOrder: 0, isDefault: false },
  { id: 2, name: 'General', code: 'GENERAL', sortOrder: 1, isDefault: true },
]
const siteKey = '1x00000000000000000000AA'
const gatewayOrigins = ['https://sandbox.debit.blinkpay.co.nz']

function button(container: HTMLElement, name: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((candidate) => candidate.textContent?.includes(name))
}
function change(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('GivingFlow', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    window.history.replaceState(null, '', '/')
    trackGivingEvent.mockClear()
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

  it('completes a monthly signed-in path with General and separate Name and Email review rows', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{ signedIn: true, firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.com' }} />))
    await act(async () => change(container.querySelector('input')!, '50'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('How often')
    await act(async () => button(container, 'Monthly')?.click())
    expect(container.textContent).toContain('When should it start')
    await act(async () => button(container, 'Tomorrow')?.click())
    expect(container.textContent).toContain('Review your gift')
    expect(container.textContent).toContain('General')
    expect(container.textContent).toContain('Name')
    expect(container.textContent).toContain('Email')

    await act(async () => button(container, 'Amount')?.click())
    await act(async () => change(container.querySelector('input')!, '75'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('Review your gift')
    expect(container.textContent).toContain('$75.00 NZD')
    expect(container.textContent).toContain('monthly')

    await act(async () => button(container, 'Name')?.click())
    expect(container.textContent).toContain('What is your first name')
    await act(async () => change(container.querySelector('input')!, 'Alexa'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('What is your last name')
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('Alexa Taylor')
    expect(container.textContent).toContain('alex@example.com')
  })

  it('keeps one-off plainly selectable without showing a starting-date step', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))
    await act(async () => change(container.querySelector('input')!, '25'))
    await act(async () => button(container, 'Continue')?.click())
    expect(button(container, 'One-off gift')).toBeTruthy()
    await act(async () => button(container, 'One-off gift')?.click())
    expect(container.textContent).toContain('What is your first name')
    expect(container.textContent).not.toContain('When should it start')
  })

  it('allows successive amount digits and a decimal without rewriting the field mid-entry', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))
    const input = container.querySelector<HTMLInputElement>('input')!
    for (const value of ['1', '12', '12.', '12.3', '12.34']) {
      await act(async () => change(input, value))
      expect(input.value).toBe(value)
    }
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('How often')
  })

  it('merges fresh signed-in Rock identity over a resumed blank guest draft', async () => {
    window.history.replaceState(null, '', '/events')
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ answers: {
      amountMinor: 5000, fundId: 2, frequency: 'monthly', startDate: '2026-09-01',
      firstName: '', lastName: '', email: '', returnPathname: '/events',
    } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested identity={{ signedIn: true, firstName: 'Fresh', lastName: 'Member', email: 'fresh@example.com' }} />))
    await act(async () => Promise.resolve())
    expect(container.textContent).toContain('Review your gift')
    expect(container.textContent).toContain('Fresh Member')
    expect(container.textContent).toContain('fresh@example.com')
  })

  it('asks only for email when that is the fresh signed-in identity field still missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ answers: {
      amountMinor: 5000, fundId: 2, frequency: 'monthly', startDate: '2026-09-01',
      firstName: '', lastName: '', email: '', returnPathname: '/',
    } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested identity={{ signedIn: true, firstName: 'Fresh', lastName: 'Member' }} />))
    await act(async () => Promise.resolve())
    expect(container.textContent).toContain('What is your email')
    expect(container.textContent).not.toContain('What is your first name')
  })

  it('accepts only exact BlinkPay HTTPS gateway origins', () => {
    expect(safeGivingGatewayRedirect('https://sandbox.debit.blinkpay.co.nz/gateway/abc',gatewayOrigins)).toBe('https://sandbox.debit.blinkpay.co.nz/gateway/abc')
    expect(safeGivingGatewayRedirect('https://merchant-gateway.example.nz/gateway/abc',['https://merchant-gateway.example.nz'])).toBe('https://merchant-gateway.example.nz/gateway/abc')
    expect(safeGivingGatewayRedirect('https://evil.test/gateway',gatewayOrigins)).toBeNull()
    expect(safeGivingGatewayRedirect('https://debit.blinkpay.co.nz.evil.test/gateway',['https://debit.blinkpay.co.nz'])).toBeNull()
  })

  it('uses one stable per-flow submission key across a safe failed retry', async () => {
    const checkoutBodies: Array<Record<string,unknown>>=[]
    vi.mocked(fetch).mockImplementation(async (input,init) => {
      const url=String(input)
      if(url==='/api/giving/drafts'&&init?.method==='PUT')return new Response(null,{status:204})
      if(url==='/api/giving/checkouts'){checkoutBodies.push(JSON.parse(String(init?.body)));return new Response(JSON.stringify({gatewayRedirectUri:'https://evil.test/gateway'}),{status:201,headers:{'content-type':'application/json'}})}
      return new Response(null,{status:204})
    })
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{signedIn:true,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'}}/>))
    await act(async()=>change(container.querySelector('input')!,'25'))
    await act(async()=>button(container,'Continue')?.click())
    await act(async()=>button(container,'One-off gift')?.click())
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async()=>button(container,'Continue to secure')?.click())
    expect(container.textContent).toContain('gift details are saved')
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async()=>button(container,'Continue to secure')?.click())
    expect(checkoutBodies).toHaveLength(2)
    expect(checkoutBodies[0].submissionKey).toBe(checkoutBodies[1].submissionKey)
    expect(String(checkoutBodies[0].submissionKey)).toHaveLength(43)
    expect(vi.mocked(fetch).mock.calls.some(([input])=>String(input).startsWith('/give/resume/'))).toBe(false)
  })

  it('backs status polling off after the safe-close threshold and caps the delay',()=>{
    expect([0,1,2,3,4,5,6,7].map(givingStatusPollDelay)).toEqual([2_000,2_000,2_000,2_000,4_000,8_000,16_000,30_000])
    expect(givingStatusPollDelay(20)).toBe(30_000)
    expect(GIVING_STATUS_POLL_LIMIT).toBe(12)
  })

  it('auto-opens an unknown return with synthetic warning and no retry',async()=>{
    window.history.replaceState(null,'','/?giving=return')
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({state:'unknown',retryAllowed:false,kind:'recurring'}),{status:200,headers:{'content-type':'application/json'}}))
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested synthetic/>))
    await act(async()=>Promise.resolve())
    expect(container.textContent).toContain('TEST DATA · BlinkPay sandbox')
    expect(container.textContent).toContain('still checking the outcome')
    expect(container.textContent).toContain('Do not try again')
    expect(button(container,'Return to your saved gift')).toBeUndefined()
  })

  it('shows delayed reassurance and limits retry to definitive failed outcomes',()=>{
    expect(givingCheckoutPresentation({state:'processing',retryAllowed:true,kind:'one-off'},false)).toEqual({message:'We’re confirming your gift with BlinkPay.',showRetry:false})
    expect(givingCheckoutPresentation({state:'processing',retryAllowed:true,kind:'one-off'},true)).toEqual({message:'This is taking a little longer. You may safely close this flow while EV keeps checking; there is no need to try again.',showRetry:false})
    expect(givingCheckoutPresentation({state:'unknown',retryAllowed:true,kind:'recurring'}).showRetry).toBe(false)
    for(const state of ['cancelled','rejected','expired'] as const)expect(givingCheckoutPresentation({state,retryAllowed:true,kind:'one-off'}).showRetry).toBe(true)
    expect(givingCheckoutPresentation({state:'verified',retryAllowed:false,kind:'recurring'}).message).toContain('schedule is active')
  })

  it('emits only deduped allowlisted synthetic lifecycle events',async()=>{
    window.history.replaceState(null,'','/?giving=return')
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({state:'verified',retryAllowed:false,kind:'one-off'}),{status:200,headers:{'content-type':'application/json'}}))
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested synthetic/>))
    await act(async()=>Promise.resolve())
    expect(trackGivingEvent.mock.calls).toEqual(expect.arrayContaining([
      ['giving_flow_started',{outcome:'started',synthetic:true}],
      ['giving_step_viewed',{step:'amount',outcome:'continued',synthetic:true}],
      ['giving_provider_returned',{step:'result',outcome:'returned',synthetic:true}],
      ['giving_outcome_verified',{step:'result',outcome:'verified',synthetic:true}],
    ]))
    expect(trackGivingEvent.mock.calls.filter(([event])=>event==='giving_provider_returned')).toHaveLength(1)
    expect(trackGivingEvent.mock.calls.filter(([event])=>event==='giving_outcome_verified')).toHaveLength(1)
    expect(trackGivingEvent.mock.calls.filter(([event])=>event==='giving_flow_started')).toHaveLength(1)
    expect(trackGivingEvent.mock.calls.filter(([event,properties])=>event==='giving_step_viewed'&&properties.step==='amount')).toHaveLength(1)
    for(const[,properties]of trackGivingEvent.mock.calls)expect(Object.keys(properties)).not.toEqual(expect.arrayContaining(['amount','fund','email','providerId','error']))
  })
})
