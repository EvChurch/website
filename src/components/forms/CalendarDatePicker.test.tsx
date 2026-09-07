// @vitest-environment jsdom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarDatePicker } from './CalendarDatePicker'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

describe('CalendarDatePicker navigation', () => {
  let container: HTMLDivElement
  let root: Root
  const onChange = vi.fn()

  beforeEach(() => {
    onChange.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  async function render(props: { min?: string; mode?: 'single' | 'range'; startDate?: string } = {}) {
    function Picker() {
      const [startDate, setStart] = useState(props.startDate ?? '')
      const [endDate, setEnd] = useState('')
      const [isOpen, setOpen] = useState(false)
      return <CalendarDatePicker {...props} id="date" label="Date" required
        startDate={startDate} endDate={endDate} isOpen={isOpen}
        onOpen={() => setOpen(true)} onComplete={() => setOpen(false)}
        onChange={(start, end) => { setStart(start); setEnd(end); onChange(start, end) }} />
    }
    await act(async () => root.render(<Picker />))
    await click('Date')
  }

  function button(label: string) {
    return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
  }

  async function click(label: string) {
    await act(async () => button(label).click())
  }

  async function select(label: string, value: string) {
    const control = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
    control.focus()
    await act(async () => {
      control.value = value
      control.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(document.activeElement).toBe(control)
  }

  it('jumps to a leap day without selecting until a day is chosen, and reopens the saved date', async () => {
    await render()
    expect(container.querySelector('input')?.required).toBe(true)
    expect(container.querySelector('input')?.value).toBe('')
    await select('Year', '2012')
    await select('Month', '2')
    expect(onChange).not.toHaveBeenCalled()
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('February 2012')
    expect(button('Choose 30 February 2012')).toBeNull()
    await click('Choose 29 February 2012')
    expect(onChange).toHaveBeenLastCalledWith('2012-02-29', '')
    expect(button('Date').textContent).toContain('29 Feb 2012')
    expect(container.querySelector('input')?.value).toBe('2012-02-29')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    await click('Date')
    expect(button('Choose 29 February 2012').getAttribute('aria-pressed')).toBe('true')
    await select('Year', '2013')
    expect(button('Choose 29 February 2013')).toBeNull()
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('clamps navigation to the minimum month and keeps earlier days disabled', async () => {
    await render({ min: '2026-08-18' })
    expect(button('Previous month').disabled).toBe(true)
    expect(container.querySelector('select[aria-label="Year"] option[value="2012"]')).toBeNull()
    await select('Year', '2027')
    await select('Month', '2')
    await select('Year', '2026')
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Month"]')?.value).toBe('8')
    expect(container.querySelector<HTMLOptionElement>('select[aria-label="Month"] option[value="7"]')?.disabled).toBe(true)
    await click('Choose 17 August 2026')
    expect(onChange).not.toHaveBeenCalled()
    await click('Choose 18 August 2026')
    expect(onChange).toHaveBeenLastCalledWith('2026-08-18', '')
  })

  it('preserves range restart, cross-year completion, and month arrow rollover', async () => {
    await render({ mode: 'range', startDate: '2013-01-15' })
    await select('Year', '2012')
    await select('Month', '12')
    await click('Choose 31 December 2012')
    expect(onChange).toHaveBeenLastCalledWith('2012-12-31', '')
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    await click('Next month')
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Year"]')?.value).toBe('2013')
    await click('Choose 2 January 2013')
    expect(onChange).toHaveBeenLastCalledWith('2012-12-31', '2013-01-02')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    await click('Date')
    await click('Previous month')
    await click('Choose 30 November 2012')
    expect(onChange).toHaveBeenLastCalledWith('2012-11-30', '')
  })
})
