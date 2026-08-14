import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CampusJsonLd } from './CampusJsonLd'

describe('CampusJsonLd', () => {
  it('publishes a valid Church place without organization-only properties', () => {
    const markup = renderToStaticMarkup(
      <CampusJsonLd
        name="Central"
        brandName="Ev Central"
        slug="central"
        address={{ street: '80 Olsen Avenue', city: 'Hillsborough' }}
        serviceDay="Sunday"
        serviceOpens="10:15"
        serviceCloses="11:30"
      />,
    )
    const json = markup.match(/<script type="application\/ld\+json">(.*)<\/script>/)?.[1]

    expect(json).toBeDefined()
    const data = JSON.parse(json!)
    expect(data['@type']).toBe('Church')
    expect(data).not.toHaveProperty('parentOrganization')
  })
})
