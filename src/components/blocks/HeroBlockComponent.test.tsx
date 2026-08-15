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

  it('eagerly loads the hero image at high fetch priority', () => {
    const markup = renderToStaticMarkup(
      <HeroBlockComponent image="/hero.jpg" heading="A place to belong" />,
    )

    expect(markup).toContain('fetchPriority="high"')
    expect(markup).toContain('loading="eager"')
    expect(markup).toContain('route-animate-fade-in-up')
    expect(markup).not.toContain('class="animate-fade-in-up')
  })

  it('uses the event-detail split layout for banner heroes', () => {
    const markup = renderToStaticMarkup(
      <HeroBlockComponent
        image="/banner.jpg"
        eyebrow="Find your people"
        heading="Connect Groups"
        subtitle="Church is more than a Sunday service."
        keyColor="#8C7B6B"
        overlayStyle="banner"
      />,
    )

    expect(markup).toContain('bg-[linear-gradient(90deg,#0b0003,#18070b_50%,#0b0003)]')
    expect(markup).toContain('lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]')
    expect(markup).toContain('order-first')
    expect(markup).toContain('lg:order-none')
    expect(markup).toContain('shadow-[0_28px_70px_rgba(0,0,0,0.53)]')
    expect(markup).toContain('color:#8C7B6B')
    expect(markup).toContain('fetchPriority="high"')
    expect(markup).toContain('loading="eager"')
    expect(markup).not.toContain('background-color:#8C7B6B')
  })

  it('preserves semantic heading levels in banner heroes', () => {
    const markup = renderToStaticMarkup(
      <HeroBlockComponent
        image="/banner.jpg"
        eyebrow="Ages 0 to 12"
        heading="Ev Kids"
        overlayStyle="banner"
        semanticH1
      />,
    )

    expect(markup).toMatch(/<h1[^>]*>Ages 0 to 12<\/h1>/)
    expect(markup).toMatch(/<h2[^>]*>Ev Kids<\/h2>/)
  })
})
