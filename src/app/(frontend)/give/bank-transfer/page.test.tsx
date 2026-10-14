import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import BankTransferPage, { metadata } from './page'

describe('Bank transfer entry page', () => {
  it('publishes the canonical route and a way to reopen the giving flow', () => {
    const markup = renderToStaticMarkup(<BankTransferPage />)

    expect(markup).toContain('Give by bank transfer')
    expect(markup).toContain('personalised internet-banking instructions and references')
    expect(markup).toContain('Start giving')
    expect(metadata.alternates).toEqual({ canonical: 'https://www.ev.church/give/bank-transfer' })
  })
})
