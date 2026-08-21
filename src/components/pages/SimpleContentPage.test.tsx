import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SimpleContentPage } from './SimpleContentPage'

describe('SimpleContentPage', () => {
  it('renders Payload content in the legal page layout', () => {
    const markup = renderToStaticMarkup(
      <SimpleContentPage
        title="Terms of Service"
        updatedAt="2026-08-22T01:30:00.000Z"
        sections={[
          {
            heading: '1. About these terms',
            body: {
              root: {
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: 'These terms apply.' }],
                  },
                ],
              },
            },
          },
        ]}
      />,
    )

    expect(markup).toContain('>Legal<')
    expect(markup).toContain('>Terms of Service<')
    expect(markup).toContain('Last updated: August 2026')
    expect(markup).toContain('>1. About these terms<')
    expect(markup).toContain('These terms apply.')
    expect(markup).toContain('max-w-3xl')
  })
})
