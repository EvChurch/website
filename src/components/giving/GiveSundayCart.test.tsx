// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { GiveSundayCart } from './GiveSundayCart'

const controls = vi.hoisted(() => ({ back: null as (() => boolean) | null }))
vi.mock('./GivingExperienceProvider', () => ({ useGivingExperience: () => ({
  registerGivingBackHandler: (handler: () => boolean) => { controls.back = handler; return () => { controls.back = null } }, dismissGiving: () => true,
}) }))
vi.mock('./GivingOpportunityStep', () => ({
  GUIDED_OPPORTUNITIES: ['plant', 'train', 'grow', 'build'],
  GivingOpportunityStep: ({ id, amount, onContinue, onGreatestNeed }: {
    id: string; amount?: number; onContinue(amount: number): void; onGreatestNeed(): void
  }) => <div data-opportunity={id}><output>{amount ?? ''}</output>
    <button data-select onClick={() => onContinue(10_000)}>Continue</button>
    <button data-general onClick={onGreatestNeed}>Greatest Need</button>
  </div>,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { controls.back = null; sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('hands the selected gifts to the shared payment flow and starts fresh after verified completion', async () => {
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches:true})))
  Object.defineProperty(window,'matchMedia',{configurable:true,value:() => ({matches:true})})
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch',fetchMock)
  const selected: unknown[] = []
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<GiveSundayCart embedded renderPayment={props => {
      selected.push(props.gifts)
      return <div><button data-back onClick={props.onBack}>Edit gifts</button><button data-verified onClick={props.onVerified}>Verified payment</button></div>
    }} />))
    expect(container.textContent).toContain('one at a time')
    expect(container.querySelector('[data-opportunity]')).toBeNull()
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Okay, let’s go')!.click())
    expect(container.querySelector('[data-opportunity]')?.getAttribute('data-opportunity')).toBe('plant')
    await act(async () => { expect(controls.back?.()).toBe(true) })
    expect(container.textContent).toContain('Okay, let’s go')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Okay, let’s go')!.click())
    for (let i=0;i<4;i++) await act(async () => container.querySelector<HTMLButtonElement>('[data-select]')!.click())
    expect(container.textContent).toContain('Review your gifts')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Continue to payment')!.click())
    expect(selected.at(-1)).toEqual(['plant','train','grow','build'].map(opportunityId => ({opportunityId,amountMinor:10000})))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-back]')!.click())
    expect(container.textContent).toContain('$400')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Continue to payment')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-verified]')!.click())
    expect(container.textContent).toContain('Your gift total: $400.')
    expect(container.querySelector('a')?.href).toBe('https://www.tearfund.org.nz/Child-Consignment/AKL-EV-Sponsorship-page')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Start over')!.click())
    expect(container.textContent).toContain('Okay, let’s go')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Okay, let’s go')!.click())
    expect(container.querySelector('[data-opportunity]')?.getAttribute('data-opportunity')).toBe('plant')
    expect(container.querySelector('output')?.textContent).toBe('')
    expect(sessionStorage.getItem('ev-give-sunday-payment')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  } finally { await act(async () => root.unmount()); container.remove() }
})

it('replaces the split with greatest need and preserves the chosen amount when returning from payment', async () => {
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
  Object.defineProperty(window,'matchMedia',{configurable:true,value:() => ({matches:true})})
  const container=document.createElement('div');document.body.append(container)
  const root=createRoot(container)
  let selected: unknown
  try {
    await act(async()=>root.render(<GiveSundayCart embedded renderPayment={props=>{selected=props.gifts;return <button data-back onClick={props.onBack}>Edit gifts</button>}} />))
    await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='Okay, let’s go')!.click())
    for(let i=0;i<4;i++) await act(async()=>container.querySelector<HTMLButtonElement>('[data-select]')!.click())
    await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='Give to greatest need')!.click())
    expect(container.querySelector('output')?.textContent).toBe('40000')
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-select]')!.click())
    expect(selected).toEqual([{opportunityId:'greatest-need',amountMinor:10000}])
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-back]')!.click())
    expect(container.querySelector('[data-opportunity]')?.getAttribute('data-opportunity')).toBe('greatest-need')
    expect(container.querySelector('output')?.textContent).toBe('10000')
    expect(container.textContent).not.toContain('Review your gifts')
  } finally {await act(async()=>root.unmount());container.remove()}
})

it('restores an existing payment without inserting the introduction before its status', async () => {
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
  sessionStorage.setItem('ev-give-sunday-selection', JSON.stringify([{opportunityId:'plant',amountMinor:20000}]))
  sessionStorage.setItem('ev-give-sunday-payment','submitted')
  const container=document.createElement('div'); document.body.append(container)
  const root=createRoot(container)
  try {
    await act(async()=>root.render(<GiveSundayCart embedded renderPayment={props=><div data-existing-payment>{props.gifts[0].amountMinor}</div>} />))
    expect(container.querySelector('[data-existing-payment]')?.textContent).toBe('20000')
    expect(container.textContent).not.toContain('Okay, let’s go')
  } finally { await act(async()=>root.unmount()); container.remove() }
})
