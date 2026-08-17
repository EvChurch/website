import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ServiceTimesBlockComponent } from './ServiceTimesBlockComponent'

describe('ServiceTimesBlockComponent', () => {
  it('renders the heading and linked service times', () => {
    const markup = renderToStaticMarkup(
      <ServiceTimesBlockComponent
        heading="Join us this Sunday"
        services={[
          { campus: 'North', time: '10:15 am', href: '/campus/north' },
          { campus: 'Central', time: '10:15 am', href: '/campus/central' },
          { campus: 'Unichurch', time: '5:15 pm', href: '/campus/unichurch' },
        ]}
      />,
    )

    expect(markup).toContain('Join us this Sunday')
    expect(markup).toContain('text-deep-red')
    expect(markup).not.toContain('tracking-[0.18em] text-rich-red')
    expect(markup).toContain('aria-label="Sunday service times"')
    expect(markup).toContain('grid-cols-1 sm:grid-cols-3')
    expect(markup).toContain('href="/campus/north"')
    expect(markup).toContain('North')
    expect(markup).toContain('Sunday · 10:15 am')
    expect(markup).toContain('href="/campus/unichurch"')
    expect(markup).toContain('Sunday · 5:15 pm')
  })

  it('renders nothing when no services are configured', () => {
    expect(renderToStaticMarkup(<ServiceTimesBlockComponent services={[]} />)).toBe('')
  })

  it.each([
    [1, 'grid-cols-1'],
    [2, 'grid-cols-1 sm:grid-cols-2'],
  ] as const)('uses %i managed service columns without empty slots', (count, className) => {
    const markup = renderToStaticMarkup(
      <ServiceTimesBlockComponent
        services={[
          { campus: 'North', time: '10:15 am', href: '/campus/north' },
          { campus: 'Central', time: '10:15 am', href: '/campus/central' },
        ].slice(0, count)}
      />,
    )

    expect(markup).toContain(className)
  })
})
