import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HeroBlockComponent } from './HeroBlockComponent'

describe('HeroBlockComponent contrast', () => {
  it('uses high-contrast image-hero accent colours and shadows', () => {
    const markup = renderToStaticMarkup(
      <HeroBlockComponent
        image="/hero.jpg"
        eyebrow="Welcome to Ev Church"
        heading="A place to belong"
        highlightedText="belong"
      />,
    )

    expect(markup).toContain('text-hero-eyebrow')
    expect(markup).toContain('text-hero-highlight')
    expect(markup).toContain('font-serif')
    expect(markup).toContain('drop-shadow-')
    expect(markup).not.toContain('text-light-red-3')
  })
})
