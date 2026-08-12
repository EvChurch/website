import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PublicErrorExperience } from './PublicErrorExperience'

describe('PublicErrorExperience', () => {
  it('renders missing-page copy with exactly one home action', () => {
    const html = renderToStaticMarkup(
      <PublicErrorExperience
        eyebrow="Page not found"
        title="We couldn't find that page"
        message="The link may be out of date."
        actions={[{ label: 'Return home', href: '/', variant: 'primary' }]}
      />,
    )
    expect(html).toContain("We couldn&#x27;t find that page")
    expect(html).toContain('The link may be out of date.')
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).toContain('href="/"')
    expect(html).toContain('Return home')
    expect(html).toContain('data-public-error-experience="true"')
  })
})
