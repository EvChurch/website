import { readFileSync } from 'node:fs'
import { JSDOM, VirtualConsole } from 'jsdom'
import { describe, expect, it } from 'vitest'

const html = readFileSync('public/generosity/calculator.html', 'utf8')

function openCalculator() {
  const errors: string[] = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', (error) => errors.push(error.message))
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://www.ev.church/generosity/calculator',
    virtualConsole,
  })
  return { dom, errors }
}

describe('standalone giving calculator', () => {
  it('annualises weekly gifts and updates the percentage when income frequency changes', () => {
    const { dom, errors } = openCalculator()
    try {
      const document = dom.window.document
      const income = document.querySelector<HTMLInputElement>('#inc-household')!
      const gift = document.querySelector<HTMLInputElement>('input[data-give="ev"]')!
      income.value = '100000'
      gift.value = '100'
      gift.closest('.row')!.querySelector('select')!.value = '52'
      gift.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
      expect(document.querySelector('#incomeTotal')!.textContent).toBe('$100,000')
      expect(document.querySelector('#evTotal')!.textContent).toBe('$5,200')
      expect(document.querySelector('#ctPct')!.textContent).toBe('5.2%')

      income.value = '2000'
      const frequency = document.querySelector<HTMLSelectElement>('#inc-household-f')!
      frequency.value = '52'
      frequency.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      expect(document.querySelector('#incomeTotal')!.textContent).toBe('$104,000')
      expect(document.querySelector('#ctPct')!.textContent).toBe('5%')
      expect(errors).toEqual([])
    } finally {
      dom.window.close()
    }
  })

  it('keeps financial inputs ephemeral and includes navigation and the giving footer', () => {
    const { dom } = openCalculator()
    try {
      const document = dom.window.document
      expect(document.querySelector('script[src]')).toBeNull()
      expect(html).not.toMatch(/\b(fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|posthog|gtag)\b/)
      expect(document.querySelector('nav a')!.getAttribute('href')).toBe('/generosity')
      expect(document.querySelector('footer a')!.getAttribute('href')).toBe('https://give.ev.church')
      expect(document.querySelector<HTMLInputElement>('#inc-household')!.value).toBe('')
    } finally {
      dom.window.close()
    }
  })
})
