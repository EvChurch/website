// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GivingCalculator } from './GivingCalculator'
;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

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

function input(id: string) {
  return container.querySelector<HTMLInputElement>(`[id="${id}"]`)!
}
async function enter(control: string | HTMLInputElement, value: string) {
  const element = typeof control === 'string' ? input(control) : control
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function select(control: string | HTMLSelectElement, value: string) {
  const element =
    typeof control === 'string'
      ? container.querySelector<HTMLSelectElement>(`[id="${control}"]`)!
      : control
  await act(async () => {
    element.value = value
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
async function click(text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (element) => element.textContent?.includes(text),
  )!
  expect(button, `Button containing ${text}`).toBeTruthy()
  await act(async () => button.click())
}
function planControl<T extends HTMLInputElement | HTMLSelectElement>(
  name: string,
) {
  return Array.from(container.querySelectorAll('#new-giving ~ div label'))
    .find((label) => label.querySelector('span')?.textContent === name)!
    .querySelector<T>('input, select')!
}
function output(name: string) {
  return container.querySelector(`[data-testid="${name}"]`)!.textContent
}
function progress() {
  return container
    .querySelector('[role="progressbar"]')!
    .getAttribute('aria-valuenow')
}
function recommendations() {
  return Array.from(container.querySelectorAll('[data-recommendation]')).map(
    (item) => item.getAttribute('data-recommendation'),
  )
}

describe('GivingCalculator', () => {
  it('keeps the Auckland median as an uncounted placeholder at every frequency', async () => {
    await act(async () => root.render(<GivingCalculator />))
    expect(input('household-amount').placeholder).toBe(
      '117,000 (Auckland median)',
    )
    expect(input('household-amount').value).toBe('')
    expect(output('giving-percentage')).toBe('$0')
    expect(progress()).toBe('8')
    expect(container.textContent).toContain(
      'Your chart will appear here once you add some giving.',
    )
    expect(container.textContent).toContain(
      'Add your household income above and this table will fill in for your household.',
    )
    for (const [frequency, placeholder] of [
      ['monthly', '9,750'],
      ['fortnightly', '4,500'],
      ['weekly', '2,250'],
    ]) {
      await select('household-frequency', frequency)
      expect(input('household-amount').placeholder).toBe(
        `${placeholder} (Auckland median)`,
      )
      expect(input('household-amount').value).toBe('')
      expect(progress()).toBe('8')
    }
    await enter('household-amount', '2250')
    expect(container.querySelector('fieldset')!.textContent).toContain(
      '$117,000 / year',
    )
    expect(progress()).toBe('42')
  })

  it('counts apprentice support outside Ev in totals, the chart and recommendations', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await enter('apprentice-amount', '100')
    expect(output('giving-percentage')).toBe('$1,200')
    expect(container.querySelectorAll('fieldset')[1].textContent).toContain(
      '$0 / year',
    )
    expect(container.querySelectorAll('fieldset')[2].textContent).toContain(
      '$1,200 / year',
    )
    expect(
      container.querySelector(
        'svg [aria-label="Outside Ev giving · $1,200/yr · 100%"]',
      ),
    ).not.toBeNull()
    expect(recommendations()).toContain('local')
    expect(container.textContent).not.toContain('effectively costs')
    expect(progress()).toBe('42')
    await enter('general-amount', '100')
    expect(recommendations()).not.toContain('local')
    expect(container.textContent).toContain(
      'your Ev giving of $5,200 effectively costs $3,467',
    )
    await enter('household-amount', '100000')
    expect(output('giving-percentage')).toBe('6.4%')
    expect(progress()).toBe('100')
  })

  it('puts the step-up increase into Ev while preserving outside giving and converting plan frequencies', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await enter('household-amount', '104000')
    await enter('general-amount', '100')
    await select('apprentice-frequency', 'weekly')
    await enter('apprentice-amount', '20')
    expect(output('giving-percentage')).toBe('6%')
    await click('next stage (7.5%)')
    expect(container.querySelector('#new-giving')!.textContent).toBe(
      'My new giving',
    )
    expect(planControl<HTMLInputElement>('Local church amount').value).toBe(
      '130.00',
    )
    expect(planControl<HTMLInputElement>('Outside Ev amount').value).toBe(
      '20.00',
    )
    expect(planControl<HTMLSelectElement>('Outside Ev frequency').value).toBe(
      'weekly',
    )
    expect(output('planned-total')).toBe('$7,800/yr')
    await select(
      planControl<HTMLSelectElement>('Local church frequency'),
      'yearly',
    )
    expect(planControl<HTMLInputElement>('Local church amount').value).toBe(
      '6760.00',
    )
    expect(output('planned-total')).toBe('$7,800/yr')
    await enter(planControl<HTMLInputElement>('Local church amount'), '7000')
    expect(output('planned-total')).toBe('$8,040/yr')
    expect(planControl<HTMLInputElement>('Outside Ev amount').value).toBe(
      '20.00',
    )
  })

  it('uses custom gift names in the legend and supports renaming and removing them', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await click('+ Add another gift')
    const name = container.querySelector<HTMLInputElement>(
      '[aria-label="Who is it for?"]',
    )!
    await enter(name, 'Food bank')
    await act(async () =>
      name.dispatchEvent(new FocusEvent('focusout', { bubbles: true })),
    )
    const amount = container.querySelector<HTMLInputElement>(
      '[aria-label="Food bank amount"]',
    )!
    await enter(amount, '50')
    expect(
      container.querySelector('svg [aria-label="Food bank · $600/yr · 100%"]'),
    ).not.toBeNull()
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Edit Food bank name"]')!
        .click(),
    )
    await enter(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Who is it for?"]',
      )!,
      'Community pantry',
    )
    expect(
      container.querySelector(
        'svg [aria-label="Community pantry · $600/yr · 100%"]',
      ),
    ).not.toBeNull()
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Remove Community pantry"]',
        )!
        .click(),
    )
    expect(output('giving-percentage')).toBe('$0')
    expect(container.textContent).not.toContain('Community pantry')
    expect(container.textContent).toContain(
      'Your chart will appear here once you add some giving.',
    )
  })

  it('switches recommendation at a tenth and stops offering a higher stage at twenty percent', async () => {
    await act(async () => root.render(<GivingCalculator />))
    expect(recommendations()).toEqual(['start'])
    await enter('household-amount', '100000')
    await select('general-frequency', 'yearly')
    await enter('general-amount', '9999')
    expect(recommendations()).toContain('personal-best')
    expect(recommendations()).not.toContain('beyond')
    await enter('general-amount', '10000')
    expect(recommendations()).toContain('beyond')
    expect(recommendations()).not.toContain('personal-best')
    await enter('general-amount', '20000')
    expect(
      Array.from(container.querySelectorAll('button')).some((button) =>
        button.textContent?.includes('next stage'),
      ),
    ).toBe(false)
  })

  it('clears figures and the plan, starts fresh on remount, and never transmits or stores inputs', async () => {
    await act(async () => root.render(<GivingCalculator />))
    expect(container.querySelector('[data-giving-private]')).not.toBeNull()
    await enter('household-amount', '100000')
    await enter('general-amount', '100')
    await click('next stage')
    expect(container.querySelector('#new-giving')).not.toBeNull()
    await click('Clear all figures')
    expect(input('household-amount').value).toBe('')
    expect(input('general-amount').value).toBe('')
    expect(output('giving-percentage')).toBe('$0')
    expect(container.querySelector('#new-giving')).toBeNull()
    expect(progress()).toBe('8')
    await enter('household-amount', '50000')
    await act(async () => root.render(<GivingCalculator key="fresh-visit" />))
    expect(input('household-amount').value).toBe('')
    expect(fetch).not.toHaveBeenCalled()
    expect(Storage.prototype.setItem).not.toHaveBeenCalled()
  })
})
