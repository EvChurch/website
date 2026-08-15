import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OrganizationJsonLd } from './OrganizationJsonLd'
import { UNICHURCH_SCHEMA_ADDRESS } from '@/lib/seo-addresses'

describe('OrganizationJsonLd', () => {
  it('publishes the verified Ev Church profiles', () => {
    const markup = renderToStaticMarkup(<OrganizationJsonLd />)
    const json = markup.match(/<script type="application\/ld\+json">(.*)<\/script>/)?.[1]

    expect(json).toBeDefined()
    const data = JSON.parse(json!)

    expect(data).not.toHaveProperty('areaServed')
    expect(data.address[2]).toEqual(UNICHURCH_SCHEMA_ADDRESS)
    expect(data.sameAs).toEqual([
      'https://www.facebook.com/aucklandev.co.nz',
      'https://www.instagram.com/aucklandev.church',
      'https://www.youtube.com/@ev.church',
      'https://open.spotify.com/show/7zhspYmybJOa54afNYEg8H?si=6hqr18IXRaKTdz_Jsnu--A',
      'https://geo.itunes.apple.com/us/podcast/auckland-ev-church-sermons/id944102025?mt=2&app=itunes',
    ])
  })
})
