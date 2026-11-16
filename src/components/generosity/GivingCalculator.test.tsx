// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GivingCalculator } from './GivingCalculator'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(Storage.prototype, 'setItem')
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function enter(id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`[id="${id}"]`)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('GivingCalculator', () => {
  it('updates giving and next-step figures, then clears everything without transmitting or storing inputs', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await enter('household-amount', '100000')
    await enter('general-amount', '100')
    expect(container.querySelector('[data-testid="annual-giving"]')!.textContent).toBe('$5,200.00')
    expect(container.querySelector('[data-testid="giving-percentage"]')!.textContent).toBe('5.2%')
    await enter('target-percentage', '10')
    expect(container.textContent).toContain('$10,000.00 a year')
    expect(container.textContent).toContain('$92.31 more per week')
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Clear all figures')!.click())
    expect(container.querySelector<HTMLInputElement>('#household-amount')!.value).toBe('')
    expect(container.querySelector('[data-testid="giving-percentage"]')!.textContent).toBe('Add your income')
    expect(fetch).not.toHaveBeenCalled()
    expect(Storage.prototype.setItem).not.toHaveBeenCalled()
  })

  it('allows extra gifts to be added and removed and starts fresh on remount', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await act(async () => Array.from(container.querySelectorAll('fieldset')[2].querySelectorAll('button')).find((button) => button.textContent?.includes('Add another amount'))!.click())
    const extra = container.querySelectorAll('fieldset')[2].querySelectorAll('input')[2]
    await enter(extra.id, '50')
    expect(container.querySelector('[data-testid="annual-giving"]')!.textContent).toBe('$600.00')
    await act(async () => extra.closest('div')!.querySelector('button')!.click())
    expect(container.querySelector('[data-testid="annual-giving"]')!.textContent).toBe('$0.00')
    await enter('household-amount', '50000')
    await act(async () => root.render(<GivingCalculator key="fresh-visit" />))
    expect(container.querySelector<HTMLInputElement>('#household-amount')!.value).toBe('')
  })
})
