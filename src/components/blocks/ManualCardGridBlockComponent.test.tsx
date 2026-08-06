import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ManualCardGridBlockComponent } from './ManualCardGridBlockComponent'

describe('ManualCardGridBlockComponent', () => {
  it('renders an embeddable map for a card with a managed map URL', () => {
    const markup = renderToStaticMarkup(
      <ManualCardGridBlockComponent
        heading="Campus addresses"
        cardStyle="info"
        cards={[
          {
            title: 'North',
            description: '9-11 Rothwell Avenue, Rosedale, Auckland',
            href:
              'https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U',
            linkLabel: 'Open in Google Maps',
          },
        ]}
      />,
    )

    expect(markup).toContain(
      'src="https://www.google.com/maps?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U&amp;output=embed"',
    )
    expect(markup).toContain('title="Map showing North campus"')
    expect(markup).toContain('loading="lazy"')
    expect(markup).toContain('href="https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U"')
    expect(markup).toContain('Open in Google Maps')
  })
})
