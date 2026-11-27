// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GivingCalculator } from './GivingCalculator'
;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const openGiving = vi.hoisted(() => vi.fn(() => true))
vi.mock('@/components/giving/GivingExperienceProvider', () => ({
  useGivingExperience: () => ({ openGiving, givingSurfaceAvailable: true }),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  openGiving.mockClear()
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
    if (element.type === 'date')
      element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
async function select(control: string | HTMLButtonElement, value: string) {
  const element =
    typeof control === 'string'
      ? container.querySelector<HTMLButtonElement>(`[id="${control}"]`)!
      : control
  await act(async () => {
    element.click()
  })
  await act(async () => {
    const labels: Record<string, string> = {
      weekly: 'Weekly',
      fortnightly: 'Fortnightly',
      monthly: 'Monthly',
      yearly: 'Yearly',
      hourly: 'Hourly',
    }
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent === labels[value])!
      .click()
  })
}
async function click(text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (element) => element.textContent?.includes(text),
  )!
  expect(button, `Button containing ${text}`).toBeTruthy()
  await act(async () => button.click())
}
function output(name: string) {
  return container.querySelector(`[data-testid="${name}"]`)!.textContent
}
function recommendations() {
  return Array.from(container.querySelectorAll('[data-recommendation]')).map(
    (item) => item.getAttribute('data-recommendation'),
  )
}

describe('GivingCalculator', () => {
  it('shows the assessment and next-step recommendations in full', async () => {
    await act(async () => root.render(<GivingCalculator />))
    expect(container.querySelector('[data-recommendation] details')).toBeNull()
    expect(container.textContent).not.toContain('Read more')
    expect(container.querySelector('[data-recommendation]')?.textContent).toContain(
      'Look at your budget',
    )
    await enter('household-amount', '100000')
    await enter('general-amount', '100')
    expect(container.querySelectorAll('[data-recommendation] details')).toHaveLength(0)
    expect(container.querySelector('[data-recommendation="personal-best"]')?.textContent).toContain(
      'To raise your percentage',
    )
  })

  it('accepts after-tax amounts with a checkbox and bases giving on take-home income', async () => {
    await act(async () => root.render(<GivingCalculator />))
    const choice = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Amount is after tax',
    )!.querySelector('input')!
    expect(choice.type).toBe('checkbox')
    expect(choice.checked).toBe(false)
    await enter('household-amount', '100000')
    await select('general-frequency', 'yearly')
    await enter('general-amount', '7537.25')
    expect(output('giving-percentage')).toBe('10%')
    await act(async () => choice.click())
    await enter('household-amount', '75372.50')
    expect(output('household-take-home')).toBe('$75,373')
    expect(output('giving-percentage')).toBe('10%')
    expect(container.querySelector('[data-testid="household-before-tax"]')).toBeNull()
    expect(container.textContent).not.toContain('Annual household income before tax')
    expect(container.textContent).not.toContain('Estimated annual before-tax income')
    expect(recommendations()).toContain('beyond')
    await click('15%')
    expect(output('setup-gift')).toBe('Set up an additional gift of $3,770 a year')
    const kiwiSaver = container.querySelector<HTMLInputElement>(
      'section[aria-label="Earner 1"] input[type="checkbox"]',
    )!
    await act(async () => kiwiSaver.click())
    expect(output('household-take-home')).toBe('$75,373')
    expect(output('giving-percentage')).toBe('10%')
    await click('+ Add another earner')
    await enter(container.querySelector<HTMLInputElement>('[aria-label="Gross pay for Earner 2"]')!, '100000')
    expect(output('household-take-home')).toBe('$150,745')
    expect(output('giving-percentage')).toBe('5%')
    await act(async () => choice.click())
    expect(choice.checked).toBe(false)
    expect(output('household-take-home')).not.toBe('$150,745')
  })

  it('suggests only an additional gift, carries over the period and has no cancellation note', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await enter('other-income-amount', '100000')
    expect(output('setup-gift')).toBe('Set up a gift of $250 a month')
    await enter('general-amount', '200')
    expect(output('setup-gift')).toBe('Set up an additional gift of $50 a week')
    expect(container.querySelector('[data-testid="cancel-current-gift"]')).toBeNull()
    await select('general-frequency', 'fortnightly')
    expect(output('setup-gift')).toBe('Set up an additional gift of $90 a fortnight')
    await select('general-frequency', 'monthly')
    await enter('general-amount', '200.50')
    expect(output('setup-gift')).toBe('Set up an additional gift of $220 a month')
  })

  it('adds the increase to General Fund while preserving Investment Fund, outside giving, one-off gifts and the refund', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await enter('other-income-amount', '100000')
    await select('general-frequency', 'yearly')
    await select('building-frequency', 'yearly')
    await enter('general-amount', '3000')
    await enter('building-amount', '1000')
    await enter('one-off-amount', '300')
    await enter('apprentice-amount', '100')
    const refund = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent === 'Give my tax refund to Ev')!.querySelector('input')!
    await act(async () => refund.click())
    await click('10%')
    expect(output('setup-gift')).toBe('Set up an additional gift of $2,000 a year')
    expect(output('additional-refund')).toBe('Plus $667 a year through your tax refund.')
    expect(container.querySelector('[aria-label="Select 10% giving"]')?.textContent).toContain('~10%')
    expect(container.querySelector('[aria-label="Select 10% giving"]')?.closest('tr')?.querySelector('td')?.textContent)
      .toBe('+$2,000(+$667 annual tax refund)')
    await select('general-frequency', 'monthly')
    await enter('general-amount', '250')
    expect(output('additional-refund')).toBe('Plus $680 a year through your tax refund.')
    await select('general-frequency', 'yearly')
    await enter('general-amount', '3000')
    await click('Set up an additional gift')
    expect(openGiving).toHaveBeenCalledWith(undefined, { amountMinor: 200000, frequency: 'annual' })
    expect(container.querySelector('[aria-label="Set up Investment Fund"]')).toBeNull()
    await enter('other-income-amount', '120000')
    expect(output('setup-gift')).toBe('Set up an additional gift of $3,500 a year')
    expect(container.querySelector('[aria-label="Set up Investment Fund"]')).toBeNull()
  })

  it('allows removing after-tax other income and updates household income', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await enter('other-income-amount', '1200')
    expect(output('household-take-home')).toBe('$1,200')
    const remove = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove Other income (after tax)"]',
    )!
    await act(async () => remove.click())
    expect(input('other-income-amount')).toBeNull()
    expect(output('household-take-home')).toBe('$0')
  })

  it('allows removing Sponsor Child and updates the giving total', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await enter('sponsor-amount', '50')
    expect(output('annual-giving')).toBe('$600')
    const remove = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove Sponsor Child"]',
    )!
    await act(async () => remove.click())
    expect(input('sponsor-amount')).toBeNull()
    expect(output('annual-giving')).toBe('$0')
  })

  it('adds the refund from all current giving to Ev once and can turn it off', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await enter('household-amount', '100000')
    await select('general-frequency', 'yearly')
    await enter('general-amount', '3000')
    await enter('apprentice-amount', '100')
    const toggle = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent === 'Give my tax refund to Ev')!
      .querySelector('input')!
    await act(async () => toggle.click())
    expect(output('tax-refund')).toBe('$1,400')
    expect(output('annual-giving')).toBe('$5,600')
    expect(output('giving-percentage')).toBe('7.4%')
    expect(container.querySelector('svg [aria-label="Tax refund · $1,400 · 25%"]')).not.toBeNull()
    await act(async () => toggle.click())
    expect(output('annual-giving')).toBe('$4,200')
    expect(toggle.checked).toBe(false)
    expect(container.querySelector('[data-testid="tax-refund"]')).toBeNull()
  })

  it('hides empty annual breakdowns and zero-value categories', async () => {
    await act(async () => root.render(<GivingCalculator />))
    const breakdown = () => Array.from(container.querySelectorAll('details'))
      .find((details) => details.querySelector('summary')?.textContent?.includes('Annual take-home'))
    expect(breakdown()).toBeUndefined()
    await enter('household-amount', '50000')
    expect(Array.from(breakdown()!.querySelectorAll('dt')).map((dt) => dt.textContent))
      .toEqual(['Gross pay', 'PAYE', 'ACC', 'Take-home pay'])
    await enter('household-amount', '0')
    expect(breakdown()).toBeUndefined()
  })

  it('adds uniquely identified income and gifts without secure browser crypto', async () => {
    vi.stubGlobal('crypto', {})
    await act(async () => root.render(<GivingCalculator />))
    await click('+ Add another income')
    await click('+ Add another gift')
    await click('+ Add another income')
    expect(
      container.querySelectorAll('[aria-label="Income name"]'),
    ).toHaveLength(2)
    expect(
      container.querySelectorAll('[aria-label="Who is it for?"]'),
    ).toHaveLength(1)
    const ids = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[id]'),
    ).map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('dismisses info on mouse leave, outside interaction and Escape', async () => {
    await act(async () => root.render(<GivingCalculator />))
    const button = container.querySelector<HTMLButtonElement>(
      '[aria-label="About income for Earner 1"]',
    )!
    function pointer(
      type: string,
      target: HTMLElement,
      relatedTarget?: HTMLElement,
    ) {
      const event = new MouseEvent(type, { bubbles: true, relatedTarget })
      Object.defineProperty(event, 'pointerType', { value: 'mouse' })
      target.dispatchEvent(event)
    }
    await act(async () => pointer('pointerover', button))
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()
    const tip = container.querySelector<HTMLElement>('[role="tooltip"]')!
    await act(async () => {
      pointer('pointerout', button, tip)
      pointer('pointerover', tip, button)
    })
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()
    await act(async () => pointer('pointerout', tip, document.body))
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
    await act(async () => button.click())
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    )
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
    await act(async () => button.click())
    await act(async () =>
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })),
    )
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('uses shared selects, inline income names and trash removal', async () => {
    await act(async () => root.render(<GivingCalculator />))
    expect(container.querySelectorAll('[aria-haspopup="listbox"]').length).toBe(
      7,
    )
    expect(
      container.querySelector('[aria-label="Remove Other income (after tax)"]'),
    ).not.toBeNull()
    expect(input('other-income-amount')).not.toBeNull()
    expect(
      Array.from(container.querySelectorAll('legend')).find(
        (legend) => legend.textContent === 'Other household income',
      )?.className,
    ).toBe('sr-only')
    await click('+ Add another income')
    const name = container.querySelector<HTMLInputElement>(
      '[aria-label="Income name"]',
    )!
    expect(document.activeElement).toBe(name)
    await enter(name, 'Side work')
    await act(async () => name.blur())
    expect(container.querySelector('[aria-label="Income name"]')).toBe(name)
    expect(name.className).toContain('bg-transparent')
    expect(
      container.querySelector('[aria-label="Edit Side work name"]'),
    ).toBeNull()
    const remove = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove Side work"]',
    )!
    expect(remove.querySelector('svg')).not.toBeNull()
    await act(async () => remove.click())
    expect(container.querySelector('[aria-label="Income name"]')).toBeNull()
    expect(input('other-income-amount')).not.toBeNull()
  })

  it('calculates Working for Families from dependents and existing income without manual or repeated income fields', async () => {
    await act(async () => root.render(<GivingCalculator />))
    expect(input('working-for-families-amount')).toBeNull()
    await enter('household-amount', '50000')
    const credit = container.querySelectorAll<HTMLInputElement>(
      'section[aria-label="Earner 1"] input[type="checkbox"]',
    )[2]
    await act(async () => credit.click())
    expect(output('household-take-home')).toBe('$41,987')
    const creditInfo = container.querySelector<HTMLButtonElement>(
      '[aria-label="About Independent earner tax credit for Earner 1"]',
    )!
    expect(container.textContent).not.toContain('Applied for 12 eligible months')
    await act(async () => creditInfo.click())
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain(
      'Applied for 12 eligible months',
    )
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    )
    const toggle = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent === 'Working for Families')!
      .querySelector('input')!
    await act(async () => toggle.click())
    const dependents = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent === 'Dependent children')!
      .querySelector('input')!
    expect(dependents.value).toBe('0')
    expect(container.textContent).not.toContain('Enter the number of dependent children.')
    await enter(dependents, '2')
    expect(output('working-for-families-total')).toBe('$20,642.50')
    expect(output('household-take-home')).toBe('$62,110')
    await enter('general-amount', '100')
    expect(output('giving-percentage')).toBe('8.4%')
    expect(credit.disabled).toBe(true)
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
    await act(async () => creditInfo.click())
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain(
      'Independent earner tax credit is unavailable while receiving Working for Families.',
    )
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    )
    expect(
      container.querySelector(
        '[aria-label="Frequency for Working for Families"]',
      ),
    ).toBeNull()
    expect(
      Array.from(container.querySelectorAll('label')).some(
        (label) => label.textContent === 'Annual family income before tax ($)',
      ),
    ).toBe(false)
    expect(input('support-amount')).toBeNull()
    const afterTax = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Amount is after tax',
    )!.querySelector('input')!
    await act(async () => afterTax.click())
    await enter('household-amount', '41467.50')
    expect(output('working-for-families-total')).toBe('$20,642.50')
    expect(output('household-take-home')).toBe('$62,110')
    await act(async () => afterTax.click())
    await enter('household-amount', '60000')
    expect(output('working-for-families-total')).toBe('$17,892.50')
    await act(async () => toggle.click())
    expect(credit.disabled).toBe(false)
    expect(
      container.querySelector('[data-testid="working-for-families-total"]'),
    ).toBeNull()
    expect(toggle.checked).toBe(false)
  })

  it('calculates giving percentages from separate earners’ take-home pay', async () => {
    await act(async () => root.render(<GivingCalculator />))
    expect(output('household-take-home')).toBe('$0')
    await enter('household-amount', '100000')
    expect(output('household-take-home')).toBe('$75,373')
    await click('+ Add another earner')
    const second = container.querySelector<HTMLInputElement>(
      '[aria-label="Gross pay for Earner 2"]',
    )!
    await enter(second, '100000')
    expect(output('household-take-home')).toBe('$150,745')
    expect(container.textContent).toContain('of our household take-home income')
    expect(container.querySelector('#giving-now')?.textContent).toBe('Our giving right now')
    const student = container.querySelector<HTMLInputElement>(
      'section[aria-label="Earner 2"] input[type="checkbox"]',
    )!
    await act(async () => student.click())
    expect(output('household-take-home')).toBe('$147,245')
    await enter('general-amount', '100')
    expect(output('giving-percentage')).toBe('3.5%')
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Remove Earner 2"]')!
        .click(),
    )
    await select('household-frequency', 'hourly')
    await enter('household-amount', '50')
    expect(output('household-take-home')).toBe('$77,983')
    expect(container.textContent).toContain('of my take-home income')
  })

  it('counts apprentice support outside Ev in totals, the chart and recommendations', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await enter('apprentice-amount', '100')
    expect(output('giving-percentage')).toBe('$1,200')
    expect(
      Array.from(container.querySelectorAll('fieldset')).find(
        (el) => el.querySelector('legend')?.textContent === 'Ev giving',
      )!.textContent,
    ).toContain('Annual Ev giving$0')
    expect(
      Array.from(container.querySelectorAll('fieldset')).find(
        (el) => el.querySelector('legend')?.textContent === 'Outside Ev giving',
      )!.textContent,
    ).toContain('Annual outside Ev giving$1,200')
    expect(
      container.querySelector(
        'svg [aria-label="Outside Ev giving · $1,200 · 100%"]',
      ),
    ).not.toBeNull()
    expect(recommendations()).toContain('local')
    expect(container.textContent).not.toContain('effectively costs')
    await enter('general-amount', '100')
    expect(recommendations()).not.toContain('local')
    expect(container.textContent).not.toContain('effectively costs')
    await enter('household-amount', '100000')
    expect(output('giving-percentage')).toBe('8.5%')
  })

  it('selects a giving row and updates the monthly setup button without a separate plan', async () => {
    await act(async () => root.render(<GivingCalculator />))
    await enter('household-amount', '104000')
    await enter('general-amount', '100')
    await select('apprentice-frequency', 'weekly')
    await enter('apprentice-amount', '20')
    expect(output('giving-percentage')).toBe('8%')
    const tiers = Array.from(
      container.querySelectorAll('table'),
    ).find((table) => table.querySelector('caption')?.textContent === 'Giving levels based on household income')!
    expect(Array.from(tiers.querySelectorAll('tbody th')).map((row) => row.textContent?.trim().split('%')[0]))
      .toEqual(['8', '~10', '~12.5', '~15', '~20'])
    expect(tiers.textContent).not.toContain('You’re about here')
    expect(Array.from(tiers.querySelectorAll('tbody tr:first-child td')).map((cell) => cell.textContent))
      .toEqual(['$120'])
    expect(Array.from(tiers.querySelectorAll('tbody tr:nth-child(2) td')).map((cell) => cell.textContent))
      .toEqual(['+$30'])
    await click('10%')
    expect(container.querySelector('#new-giving')).toBeNull()
    expect(output('setup-gift')).toBe('Set up an additional gift of $30 a week')
    expect(container.querySelector('[data-testid="additional-refund"]')).toBeNull()
    await click('15%')
    expect(container.querySelector('[aria-label="Select 15% giving"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(output('setup-gift')).toBe('Set up an additional gift of $110 a week')
    await click('Set up an additional gift')
    expect(openGiving).toHaveBeenCalledWith(undefined, { amountMinor: 11000, frequency: 'weekly' })

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
      container.querySelector('svg [aria-label="Food bank · $600 · 100%"]'),
    ).not.toBeNull()
    await enter(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Who is it for?"]',
      )!,
      'Community pantry',
    )
    expect(
      container.querySelector(
        'svg [aria-label="Community pantry · $600 · 100%"]',
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
    expect(
      container.querySelector(
        '[aria-labelledby="giving-chart-heading"] circle[stroke-dasharray]',
      ),
    ).toBeNull()
  })

  it('switches recommendation at a tenth and stops offering a higher stage at twenty percent', async () => {
    await act(async () => root.render(<GivingCalculator />))
    expect(recommendations()).toEqual(['start'])
    await enter('household-amount', '100000')
    await select('general-frequency', 'yearly')
    await enter('general-amount', '7537.24')
    expect(recommendations()).toContain('personal-best')
    expect(recommendations()).not.toContain('beyond')
    await enter('general-amount', '7537.25')
    expect(recommendations()).toContain('beyond')
    expect(recommendations()).not.toContain('personal-best')
    await enter('general-amount', '15074.50')
    expect(container.querySelector('[data-testid="setup-gift"]')).toBeNull()

  })

  it('starts fresh on remount and never transmits or stores inputs', async () => {
    await act(async () => root.render(<GivingCalculator />))
    expect(container.querySelector('[data-giving-private]')).not.toBeNull()
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
    await enter('household-amount', '100000')
    await enter('general-amount', '100')
    await click('20%')
    expect(container.querySelector('[aria-label="Select 20% giving"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(container.textContent).not.toContain('Clear all figures')
    await act(async () => root.render(<GivingCalculator key="fresh-visit" />))
    expect(input('household-amount').value).toBe('')
    expect(input('general-amount').value).toBe('')
    expect(container.querySelector('[data-testid="setup-gift"]')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(Storage.prototype.setItem).not.toHaveBeenCalled()
  })
})
