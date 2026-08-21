import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ManualCardGridBlockComponent } from './ManualCardGridBlockComponent'

describe('ManualCardGridBlockComponent', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

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
      'src="https://www.google.com/maps/embed/v1/place?key=test-api-key&amp;q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U"',
    )
    expect(markup).toContain('title="Map showing North campus"')
    expect(markup).toContain('loading="lazy"')
    expect(markup).toContain('href="https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U"')
    expect(markup).toContain('Open in Google Maps')
  })

  it('keeps the map while linking the card action to a campus page', () => {
    const markup = renderToStaticMarkup(
      <ManualCardGridBlockComponent
        heading="Campus addresses"
        cardStyle="info"
        cards={[
          {
            title: 'North',
            description: '9-11 Rothwell Avenue, Rosedale, Auckland',
            mapUrl:
              'https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U',
            href: '/campus/north',
            linkLabel: 'Learn more about North Campus',
          },
        ]}
      />,
    )

    expect(markup).toContain('src="https://www.google.com/maps/embed/v1/place?key=test-api-key')
    expect(markup).toContain('href="/campus/north"')
    expect(markup).toContain('Learn more about North Campus')
    expect(markup).toContain('h-full')
    expect(markup).not.toContain('Open in Google Maps')
  })

  it('renders profile cards with equal-height light surfaces and uncropped originals', () => {
    const markup = renderToStaticMarkup(
      <ManualCardGridBlockComponent
        heading="Executive Committee"
        cardStyle="profile"
        cards={[
          {
            title: 'Rowan Hilsden',
            subtitle: 'Senior Pastor and Chair',
            description: 'Rowan leads the committee with a substantially longer biography.',
            image: {
              url: '/media/rowan.jpg',
              alt: 'Rowan Hilsden',
              focalX: 50,
              focalY: 20,
              sizes: {
                thumbnail: { url: '/media/rowan-thumbnail.jpg', width: 400, height: 400 },
              },
            },
          },
          {
            title: 'Rachel Burden',
            description: 'Rachel serves on the committee.',
            href: '/people/rachel-burden',
            image: {
              url: '/media/rachel.jpg',
              alt: 'Rachel Burden',
              sizes: {
                medium: { url: '/media/rachel-medium.jpg', width: 900, height: 1350 },
              },
            },
          },
        ]}
      />,
    )

    expect(markup.match(/animate-on-scroll h-full/g)).toHaveLength(2)
    expect(markup.match(/flex h-full flex-col/g)).toHaveLength(2)
    expect(markup.match(/aspect-\[4\/5\]/g)).toHaveLength(2)
    expect(markup).toContain('class="group relative block h-full"')
    expect(markup).toContain('bg-white')
    expect(markup).toContain('text-brand-black')
    expect(markup).toContain('text-dark-grey')
    expect(markup).toContain('Senior Pastor and Chair')
    expect(markup).toContain('rowan.jpg')
    expect(markup).not.toContain('rowan-thumbnail.jpg')
    expect(markup).toContain('object-position:50% 20%')
  })

  it('keeps generic image-top cards on the existing dark presentation', () => {
    const markup = renderToStaticMarkup(
      <ManualCardGridBlockComponent
        cardStyle="imageTop"
        cards={[
          {
            title: 'Church Life Across Auckland',
            subtitle: 'Across the city',
            description: 'Gather throughout the week.',
            linkLabel: 'Learn more',
            image: '/media/church-life.jpg',
          },
        ]}
      />,
    )

    expect(markup).toContain('aspect-[16/10]')
    expect(markup).toContain('bg-brand-black')
    expect(markup).not.toContain('aspect-[4/5]')
  })

  it('renders unlinked team biographies without card hover while preserving email links', () => {
    const markup = renderToStaticMarkup(
      <ManualCardGridBlockComponent
        cardStyle="profile"
        cards={[
          {
            title: 'Rowan Hilsden',
            subtitle: 'Senior Pastor',
            description: 'Rowan planted Ev Church in 2012.',
            image: '/media/rowan.jpg',
            details: [{ label: 'Email', value: 'rowan.hilsden@ev.church' }],
          },
        ]}
      />,
    )

    expect(markup).toContain('href="mailto:rowan.hilsden@ev.church"')
    expect(markup).toContain('Rowan planted Ev Church in 2012.')
    expect(markup).toContain('border border-warm-grey/60 bg-white')
    expect(markup).not.toContain('hover:shadow-lg')
    expect(markup).not.toContain('group-hover:scale-105')
  })
})
