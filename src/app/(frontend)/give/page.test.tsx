import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import GivePage, { metadata } from './page'

describe('Give page', () => {
  it('provides a local giving placeholder with a launcher action', () => {
    const markup = renderToStaticMarkup(<GivePage />)

    expect(markup).toContain('Giving at Ev')
    expect(markup).toContain('why giving is good')
    expect(markup).toContain('Start giving')
    expect(markup).not.toContain('give.ev.church')
    expect(metadata.alternates).toEqual({ canonical: 'https://www.ev.church/give' })
  })
})
