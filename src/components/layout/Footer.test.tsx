import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Footer } from './Footer'

describe('Footer social links', () => {
  it('links to the verified Ev Church social and podcast profiles', () => {
    const markup = renderToStaticMarkup(<Footer />)

    expect(markup).toContain('href="https://www.facebook.com/aucklandev.co.nz"')
    expect(markup).toContain('href="https://www.instagram.com/aucklandev.church"')
    expect(markup).toContain('href="https://www.youtube.com/@ev.church"')
    expect(markup).toContain(
      'href="https://open.spotify.com/show/7zhspYmybJOa54afNYEg8H?si=6hqr18IXRaKTdz_Jsnu--A"',
    )
    expect(markup).toContain(
      'href="https://geo.itunes.apple.com/us/podcast/auckland-ev-church-sermons/id944102025?mt=2&amp;app=itunes"',
    )
  })
})
