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
  GivingOpportunityStep: ({ id, amount, onContinue, onSkip, onGreatestNeed }: {
    id: string; amount?: number; onContinue(amount: number): void; onSkip(): void; onGreatestNeed(): void
  }) => <div data-opportunity={id}><output>{amount ?? ''}</output>
    <button data-select onClick={() => onContinue(10_000)}>Continue</button>
    <button data-skip onClick={onSkip}>Skip this opportunity</button>
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
  const refreshEvents = vi.spyOn(window, 'dispatchEvent')
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
    expect(container.textContent).toContain('Give one general gift and let Ev use it wherever it is needed most.')
    expect(container.textContent).toContain("Make room for Central's Kids")
    expect(container.textContent).not.toContain("Central'S")
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Continue to payment')!.click())
    expect(selected.at(-1)).toEqual(['plant','train','grow','build'].map(opportunityId => ({opportunityId,amountMinor:10000})))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-back]')!.click())
    expect(container.textContent).toContain('$400')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Continue to payment')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-verified]')!.click())
    expect(refreshEvents).toHaveBeenCalledWith(expect.objectContaining({type:'ev-campaign-progress-refresh'}))
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


it('opens greatest need directly from the introduction and returns there with Back', async () => {
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  let selected: unknown
  try {
    await act(async () => root.render(<GiveSundayCart embedded renderPayment={props => { selected = props.gifts; return <div data-payment /> }} />))
    expect(container.textContent).toContain('After completing your gift, you’ll have the opportunity to explore child sponsorship in Cambodia through Tearfund.')
    expect(container.textContent).toContain('Give one general gift and let Ev use it wherever it is needed most.')
    const openGreatestNeed = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Give to greatest need')!.click()
    await act(async () => openGreatestNeed())
    expect(container.querySelector('[data-opportunity]')?.getAttribute('data-opportunity')).toBe('greatest-need')
    await act(async () => { expect(controls.back?.()).toBe(true) })
    expect(container.textContent).toContain('Okay, let’s go')
    await act(async () => openGreatestNeed())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-select]')!.click())
    expect(selected).toEqual([{opportunityId:'greatest-need',amountMinor:10000}])
    expect(container.querySelector('[data-payment]')).not.toBeNull()
    expect(container.textContent).not.toContain('Review your gifts')
  } finally { await act(async () => root.unmount()); container.remove() }
})


it('fades from the introduction to Plant and honours reduced motion', async () => {
  vi.useFakeTimers()
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
  let reducedMotion = false
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: reducedMotion }) })
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<GiveSundayCart embedded />))
    const start = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Okay, let’s go')!.click()
    await act(async () => start())
    expect(container.querySelector('section')?.style.opacity).toBe('0')
    expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('[data-opportunity]')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(150) })
    expect(container.querySelector('[data-opportunity]')?.getAttribute('data-opportunity')).toBe('plant')
    expect(container.querySelector('section')?.style.opacity).toBe('1')
    await act(async () => { controls.back?.() })
    reducedMotion = true
    await act(async () => start())
    expect(container.querySelector('[data-opportunity]')?.getAttribute('data-opportunity')).toBe('plant')
    expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('false')
    expect(vi.getTimerCount()).toBe(0)
  } finally { await act(async () => root.unmount()); container.remove(); vi.useRealTimers() }
})


it('shows skipped opportunities as zero in review and confirmation, without sending zero allocations to payment', async () => {
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
  Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({matches:true})})
  const container=document.createElement('div');document.body.append(container)
  const root=createRoot(container)
  let selected: unknown
  try {
    await act(async()=>root.render(<GiveSundayCart embedded renderPayment={props=>{selected=props.gifts;return <button data-verified onClick={props.onVerified}>Verified payment</button>}} />))
    await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='Okay, let’s go')!.click())
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-select]')!.click())
    for(let i=0;i<3;i++)await act(async()=>container.querySelector<HTMLButtonElement>('[data-skip]')!.click())
    const rows=[...container.querySelectorAll('li')]
    expect(rows).toHaveLength(4)
    expect(rows[0].textContent).toContain('$100')
    for(const row of rows.slice(1))expect(row.textContent).toContain('$0')
    await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='Continue to payment')!.click())
    expect(selected).toEqual([{opportunityId:'plant',amountMinor:10000}])
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-verified]')!.click())
    const allocations=container.querySelector('dl[aria-label="Your gift allocations"]')!
    expect([...allocations.querySelectorAll('dt')].map(item=>item.textContent)).toEqual(['Plant','Train','Grow','Build'])
    expect([...allocations.querySelectorAll('dd')].map(item=>item.textContent)).toEqual(['$100','$0','$0','$0'])
    expect(container.textContent).toContain('Thank you for your generosity.')
    expect(container.querySelector('a')?.href).toBe('https://www.tearfund.org.nz/Child-Consignment/AKL-EV-Sponsorship-page')
  } finally {await act(async()=>root.unmount());container.remove()}
})
