import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CampusJsonLd } from './CampusJsonLd'
import { UNICHURCH_SCHEMA_ADDRESS } from '@/lib/seo-addresses'

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

  it('normalizes the synced Unichurch venue into a complete postal address', () => {
    const markup = renderToStaticMarkup(
      <CampusJsonLd
        name="Unichurch"
        brandName="Unichurch"
        slug="unichurch"
        address={{
          street: 'Old Government House (B102), Auckland Central',
          city: 'Auckland',
          postalCode: '1010',
        }}
        serviceDay="Sunday"
        serviceOpens="17:15"
        serviceCloses="18:30"
      />,
    )
    const json = markup.match(/<script type="application\/ld\+json">(.*)<\/script>/)?.[1]

    expect(json).toBeDefined()
    expect(JSON.parse(json!).address).toEqual(UNICHURCH_SCHEMA_ADDRESS)
  })
})
