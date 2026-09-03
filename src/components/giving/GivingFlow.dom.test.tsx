// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicGivingFund } from '@/lib/giving/contracts'
import { GIVING_SAFE_CLOSE_REASSURANCE_DELAY_MS, GIVING_STATUS_POLL_LIMIT, GivingFlow, givingCheckoutPresentation, givingProgress, givingStatusPollDelay, positionGivingSurface, safeGivingGatewayRedirect } from './GivingFlow'

vi.mock('@/components/forms/TurnstileWidget', () => ({ TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => <button type="button" data-turnstile onClick={() => onToken('turnstile-token')}>Pass security check</button> }))
const trackGivingEvent=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/giving/analytics',()=>({trackGivingEvent}))
const givingContext=vi.hoisted(()=>({
  active:true,
  flagState:'enabled' as 'unresolved'|'enabled'|'disabled'|'failed',
  blinkPayEnabled:true,
  back:null as (()=>boolean)|null,
  close:null as (()=>boolean)|null,
  dismiss:vi.fn(()=>true),
}))
vi.mock('./GivingExperienceProvider',()=>({useGivingExperience:()=>({
  givingViewActive:givingContext.active,
  flagState:givingContext.flagState,
  blinkPayEnabled:givingContext.blinkPayEnabled,
  dismissGiving:givingContext.dismiss,
  registerGivingBackHandler:(handler:()=>boolean)=>{givingContext.back=handler;return()=>{if(givingContext.back===handler)givingContext.back=null}},
  registerGivingCloseHandler:(handler:()=>boolean)=>{givingContext.close=handler;return()=>{if(givingContext.close===handler)givingContext.close=null}},
})}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const funds: PublicGivingFund[] = [
  { id: 1, name: 'Missions', code: 'MISSIONS', sortOrder: 0, isDefault: false, apprenticeRelated: false },
  { id: 2, name: 'General', code: 'GENERAL', sortOrder: 1, isDefault: true, apprenticeRelated: false },
  { id: 3, name: 'Jordan Smith', code: 'APPRENTICE-JORDAN', sortOrder: 2, isDefault: false, apprenticeRelated: true },
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
async function reachSignedInReview(container: HTMLElement, root: Root) {
  await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{signedIn:true,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'}}/>))
  await act(async()=>change(container.querySelector('input')!,'25'))
  await act(async()=>button(container,'Continue')?.click())
  await act(async()=>button(container,'Just this once')?.click())
  await act(async()=>button(container,'General')?.click())
}

function elementWithRect(top: number, bottom: number) {
  const element = document.createElement('div')
  element.getBoundingClientRect = () => ({ top, bottom, height: bottom - top } as DOMRect)
  return element
}

describe('giving surface positioning', () => {
  it('moves forward journeys to the bottom and brings edited surfaces fully into view', () => {
    const scroller = elementWithRect(0, 600)
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 900 })
    scroller.scrollTop = 40
    positionGivingSurface(scroller, elementWithRect(450, 700), elementWithRect(540, 600), 'forward')
    expect(scroller.scrollTop).toBe(208)

    scroller.scrollTop = 100
    positionGivingSurface(scroller, elementWithRect(-20, 280), elementWithRect(540, 600), 'edit')
    expect(scroller.scrollTop).toBe(72)

    scroller.scrollTop = 100
    positionGivingSurface(scroller, elementWithRect(300, 590), elementWithRect(540, 600), 'surface')
    expect(scroller.scrollTop).toBe(158)
  })
})

describe('GivingFlow', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    givingContext.active=true
    givingContext.flagState='enabled'
    givingContext.blinkPayEnabled=true
    givingContext.back=null
    givingContext.close=null
    givingContext.dismiss.mockClear()
    window.history.replaceState(null, '', '/')
    trackGivingEvent.mockClear()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => undefined) } })
  })

  it('loads signed-in identity only when active and prefills the unedited flow once', async () => {
    vi.mocked(fetch).mockImplementation(async(input)=>String(input)==='/api/giving/identity'
      ? new Response(JSON.stringify({signedIn:true,firstName:'Lazy',lastName:'Member',email:'lazy@example.com'}),{status:200,headers:{'content-type':'application/json'}})
      : new Response(null,{status:204}))
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{signedIn:true}}/>))
    await act(async()=>new Promise((resolve)=>setTimeout(resolve,0)))
    expect(vi.mocked(fetch).mock.calls.filter(([input])=>String(input)==='/api/giving/identity')).toHaveLength(1)
    await act(async()=>change(container.querySelector('input')!,'25'))
    await act(async()=>button(container,'Continue')?.click())
    await act(async()=>button(container,'Just this once')?.click())
    await act(async()=>button(container,'General')?.click())
    expect(container.textContent).toContain('Continue with BlinkPay')
    expect(container.textContent).toContain('BlinkPay is a trusted third party')
  })

  it('hydrates identity before restoring after production changes from anonymous to signed in', async () => {
    const requests: string[] = []
    let resolveIdentity: ((response: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input)
      requests.push(url)
      if (url === '/api/giving/identity') return new Promise<Response>((resolve) => { resolveIdentity = resolve })
      if (url === '/api/giving/drafts' && !init?.method) return Promise.resolve(new Response(JSON.stringify({ answers: { amountMinor: 2500, fundId: 2, fundConfirmed: true, frequency: 'one-off', startDate: null, firstName: '', lastName: '', email: '' } }), { status: 200, headers: { 'content-type': 'application/json' } }))
      return Promise.resolve(new Response(null, { status: 204 }))
    })
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{ signedIn: false }} />))
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{ signedIn: true }} resumeRequested />))
    expect(container.textContent).not.toContain('Restoring your gift')
    await act(async () => resolveIdentity?.(new Response(JSON.stringify({ signedIn: true, firstName: 'Fresh', lastName: 'Member', email: 'fresh@example.com' }), { status: 200, headers: { 'content-type': 'application/json' } })))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

    expect(requests.indexOf('/api/giving/identity')).toBeLessThan(requests.indexOf('/api/giving/drafts'))
    expect(container.textContent).toContain('Continue with BlinkPay')
    expect(container.textContent).not.toContain('What is your first name?')
  })

  it('checks for a resumable draft without flashing a restoring state when none is loaded yet', async () => {
    let resolveDraft: ((response: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input) === '/api/giving/drafts' && !init?.method) {
        return new Promise<Response>((resolve) => { resolveDraft = resolve })
      }
      return Promise.resolve(new Response(null, { status: 204 }))
    })

    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested />))

    expect(container.textContent).not.toContain('Restoring your gift')
    expect(container.textContent).toContain('How much would you like to give?')
    expect(container.querySelector('input')).toBeTruthy()

    await act(async () => resolveDraft?.(new Response(null, { status: 404 })))

    expect(container.textContent).not.toContain('Restoring your gift')
    expect(container.textContent).toContain('How much would you like to give?')
    expect(container.querySelector('input')).toBeTruthy()
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })

  it('completes a monthly signed-in path and ends with a concise BlinkPay handoff', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-15T12:00:00.000Z'))
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{ signedIn: true, firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.com' }} />))
    expect(container.querySelector('[data-giving-step-preview="frequency"]')?.textContent).toBe('How often?')
    await act(async () => change(container.querySelector('input')!, '50'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('How often')
    expect(document.activeElement?.textContent).toContain('Every week')
    expect(container.querySelector('[data-question-panel="highlighted"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="Change amount"]')).toBeTruthy()
    expect(container.textContent).toContain('I’d like to give $50.00+$0.50')
    expect(container.querySelector('[data-giving-step-preview="fund"]')?.textContent).toBe('What fund should this be for?')
    expect(container.querySelector('[data-giving-step] [data-giving-step-preview]')).toBeNull()
    expect(container.textContent).not.toContain('More options')
    expect(container.textContent).not.toContain('Every day')
    expect(container.textContent).not.toContain('Every year')
    expect(button(container, 'Just this once')?.className).toContain('bg-warm-grey/70')
    expect(button(container, 'Just this once')?.className).toContain('text-brand-black')
    await act(async () => button(container, 'Every month')?.click())
    expect(container.textContent).toContain('What fund should this be for')
    expect(container.querySelector('[data-giving-step-preview="starting-date"]')?.textContent).toBe('Starting when?')
    expect(container.querySelector('[data-giving-step] [data-giving-step-preview]')).toBeNull()
    expect(document.activeElement?.textContent).toContain('Missions')
    await act(async () => button(container, 'General')?.click())
    expect(container.textContent).toContain('Starting when?')
    expect(document.activeElement?.textContent).toContain('Today')
    await act(async () => button(container, 'Choose another date')?.click())
    expect(container.querySelector('#giving-step-heading')?.textContent).toBe('OK, choose a start date')
    expect(container.querySelector('#giving-step-heading')?.className).not.toContain('hidden')
    expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe('giving-step-heading')
    expect(document.activeElement?.textContent).toContain('August')
    expect(container.querySelector('[data-giving-step] [class*="fade-in_180ms"]')).toBeTruthy()
    expect(container.querySelector('[role="option"][aria-selected="true"]')?.className).toContain('border-rich-red')
    expect(container.querySelector('[role="option"][aria-selected="true"]')?.className).not.toContain('border-4')
    expect(Array.from(container.querySelectorAll('[data-scroll-viewport]')).every((row) => row.className.includes('w-[calc(100%+2.5rem)]') && row.className.includes('[scrollbar-width:none]'))).toBe(true)
    expect(Array.from(container.querySelectorAll('[role="listbox"]')).every((row) => row.className.includes('px-5'))).toBe(true)
    const monthScroller = container.querySelector<HTMLDivElement>('[data-scroll-viewport]')!
    expect(monthScroller.className).toContain('[&_*]:select-none')
    monthScroller.setPointerCapture = vi.fn()
    monthScroller.hasPointerCapture = vi.fn(() => false)
    await act(async () => {
      monthScroller.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 180, clientY: 20, pointerId: 1, pointerType: 'mouse' }))
      monthScroller.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 174, clientY: 20, pointerId: 1, pointerType: 'mouse' }))
      monthScroller.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 174, clientY: 20, pointerId: 1, pointerType: 'mouse' }))
      button(container, 'September')?.click()
    })
    expect(button(container, 'September')?.getAttribute('aria-selected')).toBe('true')
    await act(async () => button(container, '27')?.click())
    expect(button(container, '27')?.getAttribute('aria-selected')).toBe('true')
    await act(async () => {
      monthScroller.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 180, clientY: 20, pointerId: 2, pointerType: 'mouse' }))
      monthScroller.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 20, pointerId: 2, pointerType: 'mouse' }))
      monthScroller.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 20, pointerId: 2, pointerType: 'mouse' }))
    })
    expect(monthScroller.scrollLeft).toBe(80)
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Cancel custom date"]')?.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Change amount"]')?.click())
    expect(container.textContent).toContain('How much would you like to give')
    expect(container.textContent).toContain('for General')
    expect(container.textContent).toContain('Every month')
    const laterAnswers = Array.from(container.querySelectorAll('[data-giving-answer]')).map((answer) => answer.textContent)
    expect(laterAnswers[0]).toContain('Every month')
    expect(laterAnswers[1]).toContain('for General')
    expect(container.querySelector('[data-giving-step-preview="frequency"]')).toBeNull()
    await act(async () => change(container.querySelector('input')!, '55'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('Starting when?')
    expect(container.textContent).toContain('$55.00')
    expect(container.textContent).toContain('for General')
    expect(container.textContent).toContain('Every month')
    await act(async () => button(container, 'Tomorrow')?.click())
    expect(container.textContent).toContain('Continue with BlinkPay')
    expect(container.textContent).toContain('complete your payment setup with your bank')
    expect(container.textContent).toContain('You’re giving $55.00 plus a $0.50 transaction fee to General every month, starting tomorrow. BlinkPay will charge $55.50 each time.')
    expect(container.textContent).not.toContain('$55.00 NZD')
  })

  it('hides a future-step preview when that answer is already editable', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{ signedIn: true, firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.com' }} />))
    await act(async () => change(container.querySelector('input')!, '50'))
    await act(async () => button(container, 'Continue')?.click())
    await act(async () => button(container, 'Every month')?.click())
    await act(async () => button(container, 'General')?.click())

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Change amount"]')?.click())
    expect(container.textContent).toContain('Every month')
    expect(container.querySelector('[data-giving-step-preview="frequency"]')).toBeNull()

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Change frequency"]')?.click())
    expect(container.textContent).toContain('for General')
    expect(container.querySelector('[data-giving-step-preview="fund"]')).toBeNull()
  })

  it('keeps apprentice funds out of the normal list and reveals them from the subdued option', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))
    await act(async () => change(container.querySelector('input')!, '25'))
    await act(async () => button(container, 'Continue')?.click())
    await act(async () => button(container, 'Just this once')?.click())

    expect(button(container, 'General')).toBeTruthy()
    expect(button(container, 'Jordan Smith')).toBeUndefined()
    expect(button(container, 'Apprentices')?.className).toContain('bg-warm-grey/70')

    await act(async () => button(container, 'Apprentices')?.click())

    expect(button(container, 'General')).toBeUndefined()
    expect(button(container, 'Jordan Smith')).toBeTruthy()
    expect(button(container, 'Apprentices')).toBeUndefined()
    expect(button(container, 'Back')?.className).toContain('bg-warm-grey/70')
    expect(document.activeElement?.textContent).toBe('Back')

    await act(async () => button(container, 'Back')?.click())

    expect(button(container, 'General')).toBeTruthy()
    expect(button(container, 'Jordan Smith')).toBeUndefined()
    expect(button(container, 'Apprentices')).toBeTruthy()
  })

  it('keeps one-off plainly selectable without showing a starting-date step', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))
    await act(async () => change(container.querySelector('input')!, '25'))
    await act(async () => button(container, 'Continue')?.click())
    expect(button(container, 'Just this once')).toBeTruthy()
    await act(async () => button(container, 'Just this once')?.click())
    await act(async () => button(container, 'General')?.click())
    expect(container.textContent).toContain('What is your first name')
    expect(container.textContent).not.toContain('Starting when?')
    const firstNameInput = container.querySelector<HTMLInputElement>('input')!
    expect(document.activeElement).toBe(firstNameInput)
    expect(firstNameInput.parentElement?.previousElementSibling?.className).toContain('sr-only')
    expect(firstNameInput.parentElement?.className).toContain('min-h-20')
    expect(firstNameInput.className).toContain('text-2xl')
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Continue"]')).toBeNull()
    expect(container.textContent).not.toContain('Sign in and keep these answers')
    await act(async () => change(firstNameInput, 'Ada'))
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Continue"]')).toBeTruthy()
    await act(async () => button(container, 'Continue')?.click())
    const lastNameInput = container.querySelector<HTMLInputElement>('input')!
    expect(document.activeElement).toBe(lastNameInput)
    await act(async () => change(lastNameInput, 'Lovelace'))
    await act(async () => button(container, 'Continue')?.click())
    const emailInput = container.querySelector<HTMLInputElement>('input')!
    expect(document.activeElement).toBe(emailInput)
    expect(emailInput.type).toBe('text')
    expect(emailInput.inputMode).toBe('email')
    await act(async () => change(emailInput, 'ada'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Enter a valid email address.')
    expect(container.textContent).toContain('What is your email?')
    await act(async () => change(emailInput, 'ada@example.com'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('Continue with BlinkPay')
    expect(container.textContent).toContain('You’re giving $25.00 plus a $0.50 transaction fee to General just this once. BlinkPay will charge $25.50.')
  })

  it('shows direct bank-transfer details when the BlinkPay rollout flag is off', async () => {
    givingContext.flagState='disabled'
    givingContext.blinkPayEnabled=false
    vi.mocked(fetch).mockImplementation(async(input)=>{
      if(String(input)==='/api/giving/bank-transfer')return new Response(JSON.stringify({accountName:'Auckland Evangelical Church Trust',accountNumber:'01-1845-0008260-05',particulars:'GENERAL',code:'ALOVELACE',reference:'EV123',acknowledgementToken:'A'.repeat(43)}),{status:201,headers:{'content-type':'application/json'}})
      if(String(input)==='/api/giving/bank-transfer/acknowledge')return new Response(JSON.stringify({acknowledged:true,verified:false}),{status:200,headers:{'content-type':'application/json'}})
      return new Response(null,{status:204})
    })
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{signedIn:true,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'}}/>))
    await act(async()=>change(container.querySelector('input')!,'25'))
    await act(async()=>button(container,'Continue')?.click())
    await act(async()=>button(container,'Just this once')?.click())
    await act(async()=>button(container,'General')?.click())
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async()=>Promise.resolve())
    expect(container.textContent).toContain('Use these details in your banking app')
    expect(container.textContent).toContain('Auckland Evangelical Church Trust')
    expect(container.textContent).toContain('01-1845-0008260-05')
    expect(container.textContent).toContain('GENERAL')
    expect(container.textContent).toContain('EV123')
    expect(container.textContent).toContain("I've set this up")
    expect(container.querySelectorAll('button[aria-label^="Copy "]')).toHaveLength(5)
    expect(container.querySelectorAll('a[data-bank-shortcut]')).toHaveLength(0)
    expect(container.textContent).not.toContain('Open your bank')
    expect(container.textContent).not.toContain('official New Zealand website')
    await act(async()=>container.querySelector<HTMLButtonElement>('button[aria-label="Copy account number"]')?.click())
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('01-1845-0008260-05')
    expect(container.textContent).toContain('Copied')
    await act(async()=>button(container,"I've set this up")?.click())
    expect(container.textContent).toContain('Thank you, Ada')
    expect(container.querySelector('#giving-step-heading')?.className).toContain('sr-only')
    expect(container.textContent).toContain('Ev hasn’t verified a payment yet')
    expect(container.textContent).toContain('2 Corinthians 9:7')
    expect(button(container, 'Done')).toBeTruthy()
    await act(async()=>button(container,'Done')?.click())
    expect(givingContext.dismiss).toHaveBeenCalledOnce()
    expect(container.textContent).not.toContain('Continue to BlinkPay')
    expect(container.querySelector('[data-turnstile]')).toBeNull()
  })

  it('waits for the rollout decision and freezes one payment method for the flow', async () => {
    givingContext.flagState='unresolved'
    givingContext.blinkPayEnabled=false
    await reachSignedInReview(container, root)
    expect(container.textContent).toContain('Preparing your payment options')
    expect(container.querySelector('[data-turnstile]')).toBeNull()
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input) === '/api/giving/bank-transfer')).toBe(false)

    givingContext.flagState='enabled'
    givingContext.blinkPayEnabled=true
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{signedIn:true,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'}}/>))
    expect(container.textContent).toContain('Continue with BlinkPay')
    expect(container.querySelector('[data-turnstile]')).toBeTruthy()

    givingContext.flagState='disabled'
    givingContext.blinkPayEnabled=false
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{signedIn:true,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'}}/>))
    expect(container.textContent).toContain('Continue with BlinkPay')
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input) === '/api/giving/bank-transfer')).toBe(false)
  })

  it('resolves the real Rock reference before displaying production bank-transfer instructions', async () => {
    givingContext.flagState='disabled'
    givingContext.blinkPayEnabled=false
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === '/api/giving/bank-transfer') return new Response(JSON.stringify({
          accountName: 'Auckland Evangelical Church Trust',
          accountNumber: '01-1845-0008260-05',
          particulars: 'GENERAL',
          code: 'ALOVELACE',
          reference: 'EV123',
          acknowledgementToken: 'A'.repeat(43),
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      if (String(input) === '/api/giving/bank-transfer/acknowledge') return new Response(JSON.stringify({ acknowledged: true, verified: false }), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response(null, { status: 204 })
    })
    await reachSignedInReview(container, root)
    expect(container.textContent).not.toContain('Show bank transfer details')
    expect(container.textContent).toContain('Preparing your bank details')
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    expect(container.textContent).toContain('EV123')
    expect(container.textContent).toContain('ALOVELACE')
    const call = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/giving/bank-transfer')
    expect(call?.[1]?.headers).toMatchObject({ 'x-ev-giving-request': 'bank-transfer-v1' })
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ amountMinor: 2500, transactionFeeMinor: 0 })
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input) === '/api/giving/checkouts')).toBe(false)
    await act(async()=>button(container,"I've set this up")?.click())
    expect(container.textContent).toContain('Thank you, Ada')
    expect(container.textContent).toContain('Ev hasn’t verified a payment yet')
    const acknowledgement = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/giving/bank-transfer/acknowledge')
    expect(acknowledgement?.[1]?.headers).toMatchObject({ 'x-ev-giving-request': 'bank-transfer-acknowledgement-v1' })
    expect(JSON.parse(String(acknowledgement?.[1]?.body))).toEqual({ token: 'A'.repeat(43) })
  })

  it.each([
    ['a server failure', new Response(JSON.stringify({ error: 'Giving unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } })],
    ['an invalid response', new Response(JSON.stringify({ accountName: 'Wrong account' }), { status: 200, headers: { 'content-type': 'application/json' } })],
  ])('requires an explicit bank-transfer retry after %s', async (_label, bankResponse) => {
    givingContext.flagState = 'disabled'
    givingContext.blinkPayEnabled = false
    vi.mocked(fetch).mockImplementation(async (input) => String(input) === '/api/giving/bank-transfer'
      ? bankResponse.clone()
      : new Response(null, { status: 204 }))
    await reachSignedInReview(container, root)
    await act(async () => container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not prepare your bank transfer details')
    expect(button(container, 'Show bank transfer details')).toBeUndefined()
    expect(button(container, 'Try again')).toBeTruthy()
    expect(container.querySelector<HTMLButtonElement>('[data-turnstile]')).toBeTruthy()
    await act(async () => container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    expect(vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === '/api/giving/bank-transfer')).toHaveLength(1)
    await act(async () => button(container, 'Try again')?.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    expect(vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === '/api/giving/bank-transfer')).toHaveLength(2)
  })

  it('returns from a failed BlinkPay handoff to the completed email step without leaking its error', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input)
      if (url === '/api/giving/drafts' && init?.method === 'PUT') return new Response(null, { status: 204 })
      if (url === '/api/giving/checkouts') {
        return new Response(JSON.stringify({ gatewayRedirectUri: 'https://evil.test/gateway' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(null, { status: 204 })
    })
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))
    await act(async () => change(container.querySelector('input')!, '25'))
    await act(async () => button(container, 'Continue')?.click())
    await act(async () => button(container, 'Every month')?.click())
    await act(async () => button(container, 'General')?.click())
    await act(async () => button(container, 'Tomorrow')?.click())
    await act(async () => change(container.querySelector('input')!, 'Ada'))
    await act(async () => button(container, 'Continue')?.click())
    await act(async () => change(container.querySelector('input')!, 'Lovelace'))
    await act(async () => button(container, 'Continue')?.click())
    await act(async () => change(container.querySelector('input')!, 'ada@example.com'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('Continue with BlinkPay')
    await act(async () => container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async () => button(container, 'Continue to BlinkPay')?.click())
    expect(container.textContent).toContain('gift details are saved')
    await act(async () => givingContext.back?.())
    expect(container.textContent).toContain('What is your email?')
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('ada@example.com')
    expect(container.textContent).not.toContain('gift details are saved')
  })

  it('shows progress at the bottom without step-in-progress copy', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))
    const progress = container.querySelector<HTMLElement>('[role="progressbar"]')
    const amountInput = container.querySelector<HTMLInputElement>('input')
    expect(container.textContent).not.toContain('Step in progress')
    expect(container.textContent).toContain('+$0.50 transaction fee.')
    expect(amountInput?.placeholder).toBe('1.00')
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Continue"]')).toBeNull()
    expect(container.querySelector('[data-giving-step-preview="frequency"]')?.textContent).toBe('How often?')
    await act(async () => change(amountInput!, '0.99'))
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Continue"]')).toBeNull()
    expect(container.querySelector('[data-giving-step-preview="frequency"]')?.textContent).toBe('How often?')
    await act(async () => change(amountInput!, '1.00'))
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Continue"]')).toBeTruthy()
    const frequencyPreview=container.querySelector<HTMLElement>('[data-giving-step-preview="frequency"]')
    expect(frequencyPreview?.getAttribute('aria-hidden')).toBe('true')
    expect(frequencyPreview?.textContent).toBe('How often?')
    expect(frequencyPreview?.textContent).not.toContain('Every week')
    expect(frequencyPreview?.className).toContain('mt-4')
    expect(frequencyPreview?.className).not.toContain('mt-8')
    expect(frequencyPreview?.className).not.toContain('overflow-hidden')
    expect(frequencyPreview?.className).not.toContain('mask-image')
    expect(frequencyPreview?.closest('[data-giving-step]')).toBeNull()
    const previewOutline = frequencyPreview?.querySelector('[data-giving-preview-outline]')
    expect(previewOutline?.className).toContain('rounded-full')
    expect(previewOutline?.className).toContain('ring-inset')
    expect(previewOutline?.className).not.toContain('shadow')
    const previewSurface = frequencyPreview?.querySelector('[data-giving-answer-preview]')
    expect(previewSurface?.className).toContain('rounded-full')
    expect(previewSurface?.className).toContain('bg-white')
    expect(previewSurface?.className).toContain('text-dark-grey')
    expect(previewSurface?.className).toContain('rgba(0,0,0,0.6)')
    expect(previewSurface?.className).toContain('transparent_80%')
    expect(progress?.getAttribute('aria-label')).toBe('Giving progress')
    expect(progress?.className).toContain('h-5')
    expect(progress?.getAttribute('aria-valuenow')).toBe(String(givingProgress('amount', null)))
    expect(container.querySelector('[data-giving-step]')?.className).toContain('animate-fade-in')
    expect(progress?.firstElementChild?.className).toContain('duration-500')
    const progressScrim = progress?.closest<HTMLElement>('[data-giving-progress]')
    expect(progressScrim?.className).toContain('w-full')
    expect(progressScrim?.className).toContain('absolute')
    expect(progressScrim?.className).toContain('bottom-0')
    expect(progressScrim?.className).not.toContain('sticky')
    expect(progressScrim?.className).not.toContain('shrink-0')
    expect(progressScrim?.className).not.toContain('w-dvw')
    expect(progressScrim?.className).not.toContain('-translate-x')
    expect(progressScrim?.className).toContain('from-warm-white/0')
    expect(progressScrim?.className).toContain('via-30%')
    expect(progressScrim?.className).toContain('via-warm-white')
    expect(progressScrim?.className).not.toContain('-mb-')
    expect(progressScrim?.className).toContain('env(safe-area-inset-bottom)')
    expect(progressScrim?.className).not.toContain('pb-20')
    expect(progress?.parentElement?.className).toContain('max-w-lg')
  })

  it('allows successive amount digits and a decimal without rewriting the field mid-entry', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))
    const input = container.querySelector<HTMLInputElement>('input')!
    for (const value of ['1', '12', '12.', '12.3', '12.34']) {
      await act(async () => change(input, value))
      expect(input.value).toBe(value)
    }
    await act(async () => change(input, '12.345'))
    expect(input.value).toBe('12.34')
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('How often')
    await act(async () => button(container, 'Just this once')?.click())
    expect(container.textContent).toContain('What fund should this be for')
  })

  it('merges fresh signed-in Rock identity over a resumed blank guest draft', async () => {
    window.history.replaceState(null, '', '/events')
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ answers: {
      amountMinor: 5000, fundId: 2, fundConfirmed: true, frequency: 'monthly', startDate: '2026-09-01',
      firstName: '', lastName: '', email: '',
    } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested identity={{ signedIn: true, firstName: 'Fresh', lastName: 'Member', email: 'fresh@example.com' }} />))
    await act(async () => Promise.resolve())
    expect(container.textContent).toContain('Continue with BlinkPay')
    expect(container.textContent).not.toContain('Fresh Member')
    expect(container.textContent).not.toContain('fresh@example.com')
  })

  it('asks only for email when that is the fresh signed-in identity field still missing', async () => {
    vi.mocked(fetch).mockImplementation(async(input)=>String(input)==='/api/giving/identity'
      ? new Response(JSON.stringify({signedIn:true,firstName:'Fresh',lastName:'Member'}),{status:200,headers:{'content-type':'application/json'}})
      : new Response(JSON.stringify({ answers: {
          amountMinor: 5000, fundId: 2, fundConfirmed: true, frequency: 'monthly', startDate: '2026-09-01',
          firstName: '', lastName: '', email: '',
        } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested identity={{ signedIn: true, firstName: 'Fresh', lastName: 'Member' }} />))
    await act(async () => Promise.resolve())
    expect(container.textContent).toContain('What is your email')
    expect(container.textContent).not.toContain('What is your first name')
  })

  it('restores an amount-only draft at frequency with the amount still editable', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/giving/drafts' && !init?.method) {
        return new Response(JSON.stringify({ answers: {
          amountMinor: 10000,
          fundId: null,
          fundConfirmed: false,
          frequency: null,
          startDate: null,
          firstName: '',
          lastName: '',
          email: '',
        } }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 204 })
    })

    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested />))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

    expect(container.textContent).toContain('How often?')
    expect(container.textContent).toContain('I’d like to give $100.00+$0.50')
    expect(container.querySelector('[aria-label="Change amount"]')).toBeTruthy()
  })

  it('saves completed steps progressively and discards them before explicit close', async () => {
    const writes: Array<Record<string, unknown>> = []
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/giving/drafts' && init?.method === 'PUT') writes.push(JSON.parse(String(init.body)))
      return new Response(null, { status: 204 })
    })
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{ signedIn: true, firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.com' }} />))

    await act(async () => change(container.querySelector('input')!, '100'))
    expect(writes).toHaveLength(0)
    await act(async () => button(container, 'Continue')?.click())
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(writes.at(-1)).toMatchObject({ amountMinor: 10000, fundId: null, fundConfirmed: false, frequency: null })
    expect(vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')?.[1]?.keepalive).toBe(true)

    await act(async () => button(container, 'Just this once')?.click())
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(writes.at(-1)).toMatchObject({ amountMinor: 10000, fundId: null, fundConfirmed: false, frequency: 'one-off' })

    await act(async () => button(container, 'General')?.click())
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(writes.at(-1)).toMatchObject({ amountMinor: 10000, fundId: 2, fundConfirmed: true, frequency: 'one-off' })

    expect(givingContext.close?.()).toBe(true)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(vi.mocked(fetch).mock.calls.some(([input, init]) => String(input) === '/api/giving/drafts?scope=flow' && init?.method === 'DELETE')).toBe(true)
    expect(givingContext.dismiss).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('How much would you like to give?')
    expect(givingContext.close?.()).toBe(false)
  })

  it('keeps the flow open when explicit discard fails', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === '/api/giving/drafts?scope=flow' && init?.method === 'DELETE') throw new Error('offline')
      return new Response(null, { status: 204 })
    })
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))

    expect(givingContext.close?.()).toBe(true)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

    expect(givingContext.dismiss).not.toHaveBeenCalled()
    expect(container.textContent).toContain('We could not discard your saved gift. Please try closing it again.')
    await act(async () => change(container.querySelector('input')!, '100'))
    await act(async () => button(container, 'Continue')?.click())
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    const resumedSave = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(resumedSave?.[1]?.signal?.aborted).toBe(false)
  })

  it('aborts a stalled progressive save before explicit discard', async () => {
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input) === '/api/giving/drafts' && init?.method === 'PUT') {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
        })
      }
      return Promise.resolve(new Response(null, { status: 204 }))
    })
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))
    await act(async () => change(container.querySelector('input')!, '100'))
    await act(async () => button(container, 'Continue')?.click())

    expect(givingContext.close?.()).toBe(true)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

    expect(givingContext.dismiss).toHaveBeenCalledOnce()
  })

  it('does not show the next step until the completed answer is saved', async () => {
    let resolveSave: ((response: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation((_input, init) => {
      if (init?.method !== 'PUT') return Promise.resolve(new Response(null, { status: 204 }))
      return new Promise<Response>((resolve) => { resolveSave = resolve })
    })
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))
    await act(async () => change(container.querySelector('input')!, '100'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('How much would you like to give?')

    await act(async () => resolveSave?.(new Response(null, { status: 204 })))
    expect(container.textContent).toContain('How often?')
  })

  it('allows explicit discard to be retried when its request stalls', async () => {
    vi.useFakeTimers()
    let deleteCalls = 0
    vi.mocked(fetch).mockImplementation((_input, init) => {
      if (init?.method !== 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
      deleteCalls += 1
      if (deleteCalls > 1) return Promise.resolve(new Response(null, { status: 204 }))
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    })
    await act(async () => root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} />))

    expect(givingContext.close?.()).toBe(true)
    await act(async () => vi.advanceTimersByTimeAsync(10_000))

    expect(givingContext.dismiss).not.toHaveBeenCalled()
    expect(container.textContent).toContain('We could not discard your saved gift. Please try closing it again.')
    expect(givingContext.close?.()).toBe(true)
    await act(async () => Promise.resolve())
    expect(givingContext.dismiss).toHaveBeenCalledOnce()
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
    await act(async()=>button(container,'Just this once')?.click())
    await act(async()=>button(container,'General')?.click())
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async()=>button(container,'Continue to BlinkPay')?.click())
    expect(container.textContent).toContain('gift details are saved')
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async()=>button(container,'Continue to BlinkPay')?.click())
    expect(checkoutBodies).toHaveLength(2)
    expect(checkoutBodies[0]).toMatchObject({ amountMinor: 2500, transactionFeeMinor: 50 })
    expect(checkoutBodies[0].submissionKey).toBe(checkoutBodies[1].submissionKey)
    expect(String(checkoutBodies[0].submissionKey)).toHaveLength(43)
    expect(vi.mocked(fetch).mock.calls.some(([input])=>String(input).startsWith('/give/resume/'))).toBe(false)
  })

  it('rotates the submission key after a definitive server rejection', async () => {
    const checkoutBodies: Array<Record<string, unknown>> = []
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input)
      if (url === '/api/giving/drafts' && init?.method === 'PUT') return new Response(null, { status: 204 })
      if (url === '/api/giving/checkouts') {
        checkoutBodies.push(JSON.parse(String(init?.body)))
        return new Response(JSON.stringify({ error: 'Giving unavailable', retryAllowed: true }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(null, { status: 204 })
    })
    await reachSignedInReview(container, root)
    await act(async () => container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async () => button(container, 'Continue to BlinkPay')?.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async () => button(container, 'Continue to BlinkPay')?.click())

    expect(checkoutBodies).toHaveLength(2)
    expect(checkoutBodies[0].submissionKey).not.toBe(checkoutBodies[1].submissionKey)
  })

  it('preserves the submission key after an unclassified server failure', async () => {
    const checkoutBodies: Array<Record<string, unknown>> = []
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input)
      if (url === '/api/giving/drafts' && init?.method === 'PUT') return new Response(null, { status: 204 })
      if (url === '/api/giving/checkouts') {
        checkoutBodies.push(JSON.parse(String(init?.body)))
        return new Response(JSON.stringify({ error: 'Giving unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 204 })
    })
    await reachSignedInReview(container, root)
    await act(async () => container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async () => button(container, 'Continue to BlinkPay')?.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async () => button(container, 'Continue to BlinkPay')?.click())

    expect(checkoutBodies).toHaveLength(2)
    expect(checkoutBodies[0].submissionKey).toBe(checkoutBodies[1].submissionKey)
  })

  it('requires a fresh Turnstile token after leaving the BlinkPay handoff', async () => {
    await reachSignedInReview(container, root)
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    expect(button(container,'Continue to BlinkPay')?.disabled).toBe(false)
    await act(async()=>givingContext.back?.())
    expect(container.textContent).toContain('What fund should this be for?')
    await act(async()=>button(container,'General')?.click())
    expect(container.textContent).toContain('Continue with BlinkPay')
    expect(button(container,'Continue to BlinkPay')?.disabled).toBe(true)
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    expect(button(container,'Continue to BlinkPay')?.disabled).toBe(false)
  })

  it('uses Back and Continue to walk completed steps linearly', async () => {
    await reachSignedInReview(container, root)
    expect(container.textContent).toContain('Continue with BlinkPay')

    await act(async()=>givingContext.back?.())
    expect(container.textContent).toContain('What fund should this be for?')
    await act(async()=>givingContext.back?.())
    expect(container.textContent).toContain('How often?')
    await act(async()=>givingContext.back?.())
    expect(container.textContent).toContain('How much would you like to give?')

    await act(async()=>change(container.querySelector('input')!,'30'))
    await act(async()=>button(container,'Continue')?.click())
    expect(container.textContent).toContain('How often?')
    expect(container.textContent).not.toContain('Continue with BlinkPay')
    await act(async()=>button(container,'Just this once')?.click())
    expect(container.textContent).toContain('What fund should this be for?')
  })

  it('does not use an explicit answer origin as a Back destination', async () => {
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{signedIn:true,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'}}/>))
    await act(async()=>change(container.querySelector('input')!,'25'))
    await act(async()=>button(container,'Continue')?.click())
    await act(async()=>button(container,'Every month')?.click())
    await act(async()=>button(container,'General')?.click())
    expect(container.textContent).toContain('Starting when?')

    await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Change amount"]')?.click())
    expect(container.textContent).toContain('How much would you like to give?')

    let handled = false
    await act(async()=>{ handled = givingContext.back?.() ?? false })
    expect(handled).toBe(false)
    expect(container.textContent).toContain('How much would you like to give?')
  })

  it('consumes Back and Close while checkout submission is pending and preserves its draft on unmount', async () => {
    let resolveDraft: ((response: Response) => void) | undefined
    let draftCalls=0
    let checkoutCalls=0
    vi.mocked(fetch).mockImplementation((input,init) => {
      const url=String(input)
      if(url==='/api/giving/drafts'&&init?.method==='PUT'){
        draftCalls+=1
        if(draftCalls<=3)return Promise.resolve(new Response(null,{status:204}))
        return new Promise<Response>((resolve)=>{resolveDraft=resolve})
      }
      if(url==='/api/giving/checkouts'){checkoutCalls+=1;return Promise.resolve(new Response(null,{status:500}))}
      return Promise.resolve(new Response(null,{status:204}))
    })
    await reachSignedInReview(container, root)
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async()=>button(container,'Continue to BlinkPay')?.click())
    expect(givingContext.back?.()).toBe(true)
    expect(givingContext.close?.()).toBe(true)
    expect(container.textContent).toContain('Please wait')
    await act(async()=>root.unmount())
    root=createRoot(container)
    await act(async()=>resolveDraft?.(new Response(null,{status:204})))
    expect(checkoutCalls).toBe(0)
    expect(vi.mocked(fetch).mock.calls.some(([input,init])=>String(input)==='/api/giving/drafts'&&init?.method==='DELETE')).toBe(false)
  })

  it('does not redirect when the giving view closes during an in-flight checkout', async () => {
    let resolveCheckout: ((response: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation((input,init) => {
      const url=String(input)
      if(url==='/api/giving/drafts'&&init?.method==='PUT')return Promise.resolve(new Response(null,{status:204}))
      if(url==='/api/giving/checkouts')return new Promise<Response>((resolve)=>{resolveCheckout=resolve})
      return Promise.resolve(new Response(null,{status:204}))
    })
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{signedIn:true,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'}}/>))
    await act(async()=>change(container.querySelector('input')!,'25'))
    await act(async()=>button(container,'Continue')?.click())
    await act(async()=>button(container,'Just this once')?.click())
    await act(async()=>button(container,'General')?.click())
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async()=>button(container,'Continue to BlinkPay')?.click())
    givingContext.active=false
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{signedIn:true,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'}}/>))
    await act(async()=>resolveCheckout?.(new Response(JSON.stringify({gatewayRedirectUri:'https://sandbox.debit.blinkpay.co.nz/gateway/mock'}),{status:201,headers:{'content-type':'application/json'}})))
    expect(window.location.href).toBe('http://localhost:3000/')
  })

  it('enters no-retry unknown status for an ambiguous 202 without resetting the saved flow', async () => {
    let checkoutCalls=0
    vi.mocked(fetch).mockImplementation(async (input,init) => {
      const url=String(input)
      if(url==='/api/giving/drafts'&&init?.method==='PUT')return new Response(null,{status:204})
      if(url==='/api/giving/checkouts'){
        checkoutCalls+=1
        return new Response(JSON.stringify({outcome:'unknown',retryAllowed:false,correlationKey:'correlation',reused:false}),{status:202,headers:{'content-type':'application/json'}})
      }
      return new Response(null,{status:204})
    })
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} identity={{signedIn:true,firstName:'Ada',lastName:'Lovelace',email:'ada@example.com'}}/>))
    await act(async()=>change(container.querySelector('input')!,'25'))
    await act(async()=>button(container,'Continue')?.click())
    await act(async()=>button(container,'Just this once')?.click())
    await act(async()=>button(container,'General')?.click())
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-turnstile]')?.click())
    await act(async()=>button(container,'Continue to BlinkPay')?.click())
    expect(checkoutCalls).toBe(1)
    expect(container.textContent).toContain('still checking the outcome')
    expect(container.textContent).toContain('Do not try again')
    expect(container.textContent).not.toContain('gift details are saved; please try again')
    expect(button(container,'Return to your saved gift')).toBeUndefined()
    expect(container.querySelector('[data-turnstile]')).toBeNull()
  })

  it('backs status polling off after the safe-close threshold and caps the delay',()=>{
    expect([0,1,2,3,4,5,6,7].map(givingStatusPollDelay)).toEqual([2_000,2_000,2_000,2_000,4_000,8_000,16_000,30_000])
    expect(givingStatusPollDelay(20)).toBe(30_000)
    expect(GIVING_STATUS_POLL_LIMIT).toBe(12)
  })

  it('schedules real status polls at the backoff delay and stops after a terminal result',async()=>{
    vi.useFakeTimers()
    window.history.replaceState(null,'','/?giving=return')
    let statusCalls=0
    vi.mocked(fetch).mockImplementation(async(input)=>{
      if(String(input)==='/api/giving/checkouts/current/status'){
        statusCalls+=1
        const state=statusCalls<3?'processing':'verified'
        return new Response(JSON.stringify({state,retryAllowed:false,kind:'recurring'}),{status:200,headers:{'content-type':'application/json'}})
      }
      return new Response(null,{status:204})
    })
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested/>))
    expect(statusCalls).toBe(1)
    await act(async()=>vi.advanceTimersByTimeAsync(1_999))
    expect(statusCalls).toBe(1)
    await act(async()=>vi.advanceTimersByTimeAsync(1))
    expect(statusCalls).toBe(2)
    await act(async()=>vi.advanceTimersByTimeAsync(2_000))
    expect(statusCalls).toBe(3)
    expect(container.textContent).toContain('schedule is active')
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
    await act(async()=>vi.advanceTimersByTimeAsync(60_000))
    expect(statusCalls).toBe(3)
  })

  it('keeps actively confirming for 30 seconds before showing the safe-close reassurance',async()=>{
    vi.useFakeTimers()
    window.history.replaceState(null,'','/?giving=return')
    vi.mocked(fetch).mockImplementation(async(input)=>{
      if(String(input)==='/api/giving/checkouts/current/status'){
        return new Response(JSON.stringify({state:'processing',retryAllowed:false,kind:'one-off'}),{status:200,headers:{'content-type':'application/json'}})
      }
      return new Response(null,{status:204})
    })
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested/>))
    expect(container.textContent).toContain('We’re confirming your gift with BlinkPay.')
    expect(container.textContent).not.toContain('This is taking a little longer')
    await act(async()=>vi.advanceTimersByTimeAsync(GIVING_SAFE_CLOSE_REASSURANCE_DELAY_MS-1))
    expect(container.textContent).toContain('We’re confirming your gift with BlinkPay.')
    expect(container.textContent).not.toContain('This is taking a little longer')
    await act(async()=>vi.advanceTimersByTimeAsync(1))
    expect(container.textContent).toContain('This is taking a little longer')
  })

  it('cancels an in-flight status poll on unmount and never schedules another',async()=>{
    vi.useFakeTimers()
    window.history.replaceState(null,'','/?giving=return')
    let statusCalls=0
    let resolveStatus: ((response: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation((input)=>{
      if(String(input)==='/api/giving/checkouts/current/status'){
        statusCalls+=1
        return new Promise<Response>((resolve)=>{resolveStatus=resolve})
      }
      return Promise.resolve(new Response(null,{status:204}))
    })
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested/>))
    expect(statusCalls).toBe(1)
    await act(async()=>root.unmount())
    root=createRoot(container)
    await act(async()=>resolveStatus?.(new Response(JSON.stringify({state:'processing',retryAllowed:false,kind:'one-off'}),{status:200,headers:{'content-type':'application/json'}})))
    await act(async()=>vi.advanceTimersByTimeAsync(60_000))
    expect(statusCalls).toBe(1)
  })

  it('does not stay restoring when draft restoration throws',async()=>{
    vi.mocked(fetch).mockImplementation((input,init)=>{
      if(String(input)==='/api/giving/drafts'&&!init?.method)return Promise.reject(new Error('offline'))
      return Promise.resolve(new Response(null,{status:204}))
    })
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested/>))
    await act(async()=>Promise.resolve())
    expect(container.textContent).not.toContain('Restoring your gift')
    expect(container.textContent).toContain('could not restore your saved gift')
  })

  it('returns to a usable configuration when retry restoration throws',async()=>{
    window.history.replaceState(null,'','/?giving=return')
    let statusRead=false
    vi.mocked(fetch).mockImplementation((input,init)=>{
      const url=String(input)
      if(url==='/api/giving/checkouts/current/status'&&!statusRead){statusRead=true;return Promise.resolve(new Response(JSON.stringify({state:'cancelled',retryAllowed:true,kind:'one-off'}),{status:200,headers:{'content-type':'application/json'}}))}
      if(url==='/api/giving/drafts'&&!init?.method)return Promise.reject(new Error('offline'))
      return Promise.resolve(new Response(null,{status:204}))
    })
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested/>))
    await act(async()=>Promise.resolve())
    await act(async()=>button(container,'Return to your saved gift')?.click())
    expect(container.textContent).not.toContain('Restoring your gift')
    expect(container.textContent).toContain('could not restore your saved gift')
    expect(container.textContent).toContain('How much would you like to give')
  })

  it('auto-opens an unknown return without a retry action',async()=>{
    window.history.replaceState(null,'','/?giving=return')
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({state:'unknown',retryAllowed:false,kind:'recurring'}),{status:200,headers:{'content-type':'application/json'}}))
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested/>))
    await act(async()=>Promise.resolve())
    expect(container.textContent).not.toContain('TEST DATA')
    expect(container.textContent).toContain('still checking the outcome')
    expect(container.textContent).toContain('Do not try again')
    expect(button(container,'Return to your saved gift')).toBeUndefined()
    expect(container.textContent).not.toContain('Would you tell us what happened?')
  })

  it('shows neutral failed copy and records one category-only feedback answer',async()=>{
    window.history.replaceState(null,'','/?giving=return')
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({state:'rejected',retryAllowed:true,kind:'one-off'}),{status:200,headers:{'content-type':'application/json'}}))
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested/>))
    await act(async()=>Promise.resolve())

    expect(container.textContent).toContain('Gift not completed')
    expect(container.textContent).toContain('No gift was made.')
    expect(container.textContent).toContain('Would you tell us what happened?')
    expect(container.textContent).toContain('I went back to change something')
    expect(container.textContent).toContain('I decided not to give')
    expect(container.textContent).toContain('I was testing')
    expect(container.textContent).toContain('Something didn\u2019t work')
    expect(container.textContent).toContain('Prefer not to say')

    const testingOption=container.querySelector<HTMLInputElement>('input[value="testing"]')!
    await act(async()=>testingOption.click())
    await act(async()=>button(container,'Send feedback')?.click())

    expect(trackGivingEvent.mock.calls.filter(([event])=>event==='giving_outcome_feedback')).toEqual([
      ['giving_outcome_feedback',{step:'result',outcome:'failed',feedback_reason:'testing'}],
    ])
    expect(container.textContent).toContain('Thanks for letting us know.')
    expect(button(container,'Send feedback')).toBeUndefined()
  })

  it('shows delayed reassurance and limits retry to definitive failed outcomes',()=>{
    expect(givingCheckoutPresentation({state:'processing',retryAllowed:true,kind:'one-off'},false)).toEqual({message:'We’re confirming your gift with BlinkPay.',showRetry:false})
    expect(givingCheckoutPresentation({state:'processing',retryAllowed:true,kind:'one-off'},true)).toEqual({message:'This is taking a little longer. You may safely close this flow while Ev keeps checking; there is no need to try again.',showRetry:false})
    expect(givingCheckoutPresentation({state:'unknown',retryAllowed:true,kind:'recurring'}).showRetry).toBe(false)
    for(const state of ['cancelled','rejected','expired'] as const)expect(givingCheckoutPresentation({state,retryAllowed:true,kind:'one-off'})).toEqual({message:'No gift was made.',showRetry:true})
    expect(givingCheckoutPresentation({state:'verified',retryAllowed:false,kind:'recurring'}).message).toContain('schedule is active')
  })

  it('emits only deduped allowlisted lifecycle events',async()=>{
    window.history.replaceState(null,'','/?giving=return')
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({state:'verified',retryAllowed:false,kind:'one-off'}),{status:200,headers:{'content-type':'application/json'}}))
    await act(async()=>root.render(<GivingFlow funds={funds} gatewayOrigins={gatewayOrigins} turnstileSiteKey={siteKey} resumeRequested/>))
    await act(async()=>Promise.resolve())
    expect(trackGivingEvent.mock.calls).toEqual(expect.arrayContaining([
      ['giving_flow_started',{outcome:'started'}],
      ['giving_step_viewed',{step:'amount',outcome:'continued'}],
      ['giving_provider_returned',{step:'result',outcome:'returned'}],
      ['giving_outcome_verified',{step:'result',outcome:'verified'}],
    ]))
    expect(trackGivingEvent.mock.calls.filter(([event])=>event==='giving_provider_returned')).toHaveLength(1)
    expect(trackGivingEvent.mock.calls.filter(([event])=>event==='giving_outcome_verified')).toHaveLength(1)
    expect(trackGivingEvent.mock.calls.filter(([event])=>event==='giving_flow_started')).toHaveLength(1)
    expect(trackGivingEvent.mock.calls.filter(([event,properties])=>event==='giving_step_viewed'&&properties.step==='amount')).toHaveLength(1)
    for(const[,properties]of trackGivingEvent.mock.calls)expect(Object.keys(properties)).not.toEqual(expect.arrayContaining(['amount','fund','email','providerId','error']))
  })
})
