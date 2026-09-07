import { JSDOM } from 'jsdom'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HeroBlockComponent } from './HeroBlockComponent'
import { CTABlockComponent } from './CTABlockComponent'

const description = 'Monday, 14 September, 6:30 pm · Seminar Room'
const buttons = [
  { label: 'Register now', href: '?launcher=registration&registrationInstanceId=85' },
  { label: 'More info', href: '/events/explaining-christianity' },
]

describe('event CTA details', () => {
  it.each(['hero', 'banner', 'cta'] as const)('places visible small-print details below the actions (%s)', (type) => {
    const element = type === 'cta'
      ? <CTABlockComponent heading="Curious?" buttons={buttons} actionDescription={description} />
      : <HeroBlockComponent image="/hero.jpg" heading="Explaining Christianity" buttons={buttons}
          overlayStyle={type === 'banner' ? 'banner' : 'default'} actionDescription={description} />
    const document = new JSDOM(renderToStaticMarkup(element)).window.document
    const details = Array.from(document.querySelectorAll('p')).find((p) => p.textContent === description)!
    const moreInfo = Array.from(document.querySelectorAll('a')).find((a) => a.textContent === 'More info')!
    expect(details).toBeDefined()
    expect(details.className).toContain('text-sm')
    expect(details.className).not.toContain('hidden')
    expect(moreInfo.compareDocumentPosition(details) & 4).toBe(4)
  })
})
