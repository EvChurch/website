import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Footer } from './Footer'

describe('Footer social links', () => {
  it('uses the Ev Church logo and gives the tagline the full desktop width', () => {
    const markup = renderToStaticMarkup(<Footer />)

    expect(markup).toContain('ev-church-logo.png')
    expect(markup).toContain('aria-label="Ev Church, return to home"')
    expect(markup).toContain('lg:whitespace-nowrap')
    expect(markup).not.toContain('max-w-xs')
  })

  it('links to the public HTML sitemap', () => {
    const markup = renderToStaticMarkup(<Footer />)

    expect(markup).toContain('href="/sitemap"')
    expect(markup).toContain('>Sitemap<')
    expect(markup).toContain('>Blog<')
    expect(markup).toContain('href="/give"')
    expect(markup).not.toContain('give.ev.church')
  })

  it('uses accessible footer text colors on the warm-white background', () => {
    const markup = renderToStaticMarkup(<Footer />)

    expect(markup).toContain('text-dark-grey transition-colors duration-150 hover:text-deep-red')
    expect(markup).toContain('text-xs text-dark-grey')
    expect(markup).not.toContain('text-mid-grey/70')
  })

  it('places campus service times on a visible line below each campus link', () => {
    const markup = renderToStaticMarkup(<Footer />)

    expect(markup).toContain('href="/campus/north"')
    expect(markup).toContain('href="/campus/north">North<span class="block text-[0.8125rem] font-medium leading-tight text-dark-grey transition-colors duration-150 group-hover:text-rich-red">Sun 10:15 am</span></a>')
    expect(markup).toContain('href="/campus/central">Central<span class="block text-[0.8125rem] font-medium leading-tight text-dark-grey transition-colors duration-150 group-hover:text-rich-red">Sun 10:15 am</span></a>')
    expect(markup).toContain('href="/campus/unichurch">Unichurch<span class="block text-[0.8125rem] font-medium leading-tight text-dark-grey transition-colors duration-150 group-hover:text-rich-red">Sun 5:15 pm</span></a>')
  })

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
