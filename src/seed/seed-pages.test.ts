import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  NEWISH_CONNECTION_BLOCK_GUID,
  OLD_NEWISH_WORKFLOW_GUID,
  ensureNewishConnectionForm,
} from './newish-form'
import { EXPLAINING_CHRISTIANITY_CONNECTION_BLOCK_GUID } from './explaining-christianity-form'
import { createPageUpserter, type PageSeedClient } from './page-upsert'

const seedSource = readFileSync(new URL('./seed-pages.ts', import.meta.url), 'utf8')

function sourceSection(startMarker: string, endMarker: string): string {
  const start = seedSource.indexOf(startMarker)
  const end = seedSource.indexOf(endMarker, start)
  if (start < 0 || end < 0) {
    throw new Error(`Unable to find seed section from ${startMarker} to ${endMarker}`)
  }
  return seedSource.slice(start, end)
}

const closingCta = {
  blockType: 'cta',
  heading: 'We would love to meet you',
  text: 'Existing closing copy',
}

function form(overrides: Record<string, unknown> = {}) {
  return {
    blockType: 'formEmbed',
    sourceType: 'connectionOpportunity',
    rockConnectionBlockGuid: NEWISH_CONNECTION_BLOCK_GUID,
    layout: 'centered',
    ...overrides,
  }
}

describe('ensureNewishConnectionForm', () => {
  it('maps the live form pages to their matching Rock sources', () => {
    const visitSection = sourceSection("await upsertPage('visit'", "await upsertPage('about'")
    const newishSection = sourceSection(
      "await upsertPage('newish'",
      "await upsertPage('explaining-christianity'",
    )
    const explainingChristianitySection = sourceSection(
      "await upsertPage('explaining-christianity'",
      "await upsertPage('connect-groups'",
    )
    expect(visitSection).toContain("rockWorkflowGuid: 'de3d06a6-7fca-41a5-8c37-a485767de970'")
    expect(newishSection).toContain('layout: ensureNewishConnectionForm([')
    expect(newishSection).not.toContain(OLD_NEWISH_WORKFLOW_GUID)
    expect(explainingChristianitySection).toContain(
      "sourceType: 'connectionOpportunity'",
    )
    expect(explainingChristianitySection).toContain(
      'rockConnectionBlockGuid:',
    )
    expect(explainingChristianitySection).toContain(
      'EXPLAINING_CHRISTIANITY_CONNECTION_BLOCK_GUID',
    )
    expect(EXPLAINING_CHRISTIANITY_CONNECTION_BLOCK_GUID).toBe(
      'bb4f2585-2b30-49c1-ae82-f13b060b84c1',
    )
    expect(explainingChristianitySection).not.toContain(
      '16d675d3-00cf-459e-990d-817003cbbc88',
    )
    expect(seedSource.match(/sourceType: 'workflow'/g)).toHaveLength(2)
  })

  it('inserts exactly one centered form immediately before the closing CTA', () => {
    const result = ensureNewishConnectionForm([
      { blockType: 'content', heading: 'Keep me' },
      closingCta,
    ])
    expect(result.map((block) => block.blockType)).toEqual([
      'content',
      'formEmbed',
      'cta',
    ])
    expect(result[1]).toMatchObject({
      sourceType: 'connectionOpportunity',
      rockConnectionBlockGuid: NEWISH_CONNECTION_BLOCK_GUID,
      layout: 'centered',
    })
    expect(result[1]).not.toHaveProperty('rockWorkflowGuid')
    expect(result[2]).toEqual(closingCta)
  })

  it('is idempotent when applied repeatedly', () => {
    const once = ensureNewishConnectionForm([closingCta])
    const twice = ensureNewishConnectionForm(once)
    expect(twice).toEqual(once)
    expect(twice.filter((block) => block.blockType === 'formEmbed')).toHaveLength(1)
  })

  it('converts the old Newish workflow source without retaining its GUID', () => {
    const result = ensureNewishConnectionForm([
      form({
        sourceType: 'workflow',
        rockConnectionBlockGuid: undefined,
        rockWorkflowGuid: OLD_NEWISH_WORKFLOW_GUID,
        heading: 'Preserved form copy',
      }),
      closingCta,
    ])
    expect(result[0]).toMatchObject({
      heading: 'Preserved form copy',
      sourceType: 'connectionOpportunity',
      rockConnectionBlockGuid: NEWISH_CONNECTION_BLOCK_GUID,
    })
    expect(result[0]).not.toHaveProperty('rockWorkflowGuid')
  })

  it('collapses duplicate Newish targets but preserves unrelated forms and copy', () => {
    const unrelated = form({
      rockConnectionBlockGuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      heading: 'Unrelated form',
    })
    const result = ensureNewishConnectionForm([
      form({ heading: 'Chosen copy' }),
      unrelated,
      form({ rockWorkflowGuid: OLD_NEWISH_WORKFLOW_GUID }),
      closingCta,
    ])
    expect(
      result.filter(
        (block) => block.rockConnectionBlockGuid === NEWISH_CONNECTION_BLOCK_GUID,
      ),
    ).toHaveLength(1)
    expect(result).toContainEqual(unrelated)
    expect(result.find((block) => block.heading === 'Chosen copy')).toBeTruthy()
  })

  it('fails closed when the closing CTA is absent or ambiguous', () => {
    expect(() => ensureNewishConnectionForm([])).toThrow('closing CTA')
    expect(() => ensureNewishConnectionForm([closingCta, closingCta])).toThrow(
      'closing CTA',
    )
  })
})

describe('seeded page content and giving navigation', () => {
  it('does not recreate the retired Next Steps landing page', () => {
    expect(seedSource).not.toContain("upsertPage('next-steps'")
  })

  it('does not use em dashes in seeded page copy', () => {
    expect(seedSource).not.toContain('—')
  })

  it('replaces every managed field on existing pages from the authoritative seed', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 42 }] })
    const update = vi.fn().mockResolvedValue({})
    const create = vi.fn()
    const upsertPage = createPageUpserter({ find, update, create } as unknown as PageSeedClient)

    await upsertPage('visit', {
      title: 'Visit',
      layout: [{ blockType: 'content' }],
      seo: { metaTitle: 'Visit us' },
      _status: 'published',
    })

    expect(update).toHaveBeenCalledWith({
      collection: 'pages',
      id: '42',
      data: {
        title: 'Visit',
        slug: 'visit',
        layout: [{ blockType: 'content' }],
        template: 'standard',
        seo: {
          metaTitle: 'Visit us',
          metaDescription: null,
          ogImage: null,
        },
        _status: 'published',
      },
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('creates missing pages from the same canonical seed payload', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const update = vi.fn()
    const create = vi.fn().mockResolvedValue({})
    const upsertPage = createPageUpserter({ find, update, create } as unknown as PageSeedClient)

    await upsertPage('kids', {
      title: 'Kids',
      layout: [],
      template: 'ministry',
      _status: 'published',
    })

    expect(create).toHaveBeenCalledWith({
      collection: 'pages',
      data: {
        title: 'Kids',
        slug: 'kids',
        layout: [],
        template: 'ministry',
        seo: {
          metaTitle: null,
          metaDescription: null,
          ogImage: null,
        },
        _status: 'published',
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('passes the homepage ten-second test without using the SEO eyebrow as the H1', () => {
    const homeSection = sourceSection("await upsertPage('home'", "await upsertPage('visit'")

    expect(homeSection).toContain("eyebrow: 'Welcome to Ev Church'")
    expect(homeSection).toContain("heading: 'A place to belong'")
    expect(homeSection).toContain('one church family across three Auckland campuses')
    expect(homeSection).not.toContain('campuses — people')
    expect(homeSection).toContain('semanticH1: false')
    expect(homeSection).toContain("minHeight: '50vh'")
    expect(homeSection).toContain("{ label: \"What we're about\", href: '/about', variant: 'text' }")
    expect(homeSection).toContain(
      "metaTitle: 'Church in Auckland | Ev Church | Sundays 10:15am & 5:15pm'",
    )
  })

  it('sets an honest expectation for the Plan Your Visit form', () => {
    const visitSection = sourceSection("await upsertPage('visit'", "await upsertPage('about'")

    expect(visitSection).toContain("You don't have to. You're welcome to just turn up.")
    expect(visitSection).toContain('help with kids check-in')
  })

  it('omits the season-of-life card grid from Connect Groups', () => {
    const connectGroupsSection = sourceSection(
      "await upsertPage('connect-groups'",
      "await upsertPage('give'",
    )

    expect(connectGroupsSection).not.toContain('Groups for every season of life')
    expect(connectGroupsSection).not.toContain("title: 'Young Adults'")
  })

  it('links Contact page campus cards to their campus pages while retaining maps', () => {
    const contactSection = sourceSection("await upsertPage('contact'", "await upsertPage('kids'")

    expect(contactSection).toContain("mapUrl: CAMPUS_PAGE_DEFAULTS.north.pageContent.mapUrl")
    expect(contactSection).toContain("href: '/campus/north'")
    expect(contactSection).toContain("href: '/campus/central'")
    expect(contactSection).toContain("href: '/campus/unichurch'")
    expect(contactSection).not.toContain("linkLabel: 'Open in Google Maps'")
  })

  it('walks visitors through the service and answers the awkward questions directly', () => {
    const visitSection = sourceSection("await upsertPage('visit'", "await upsertPage('about'")

    expect(visitSection).toContain("heading: 'What actually happens in a service?'")
    expect(visitSection).toContain("title: '1. We sing.'")
    expect(visitSection).toContain("title: \"2. We hear what's on.\"")
    expect(visitSection).toContain("title: '3. We open the Bible.'")
    expect(visitSection).toContain("title: '4. We sing again, and we eat.'")
    expect(visitSection).toContain(
      "heading: 'Will I be asked to stand up, say anything, or give money?'",
    )
    expect(visitSection).toContain('No, no, and no.')
    expect(visitSection).not.toContain("You're our guest —")
    expect(visitSection).toContain('Nobody will single you out')
  })

  it('gives outsiders a clear beliefs on-ramp and makes the team approachable', () => {
    const aboutSection = sourceSection("await upsertPage('about'", "await upsertPage('vision'")
    const beliefsSection = sourceSection(
      "await upsertPage('what-we-believe'",
      "await upsertPage('faq'",
    )

    expect(beliefsSection).toContain('The short version is a person.')
    expect(beliefsSection).toContain('Everything we believe centres on Jesus')
    expect(beliefsSection).toContain('the best place to start is The Good News')
    expect(beliefsSection).toContain('final consummation of our hope with the return of Christ')
    expect(beliefsSection).toContain('Not every gift of the Spirit is given to the church')
    expect(beliefsSection).toContain('roles of men and women are not interchangeable')
    expect(aboutSection).toContain('Every email below is real and read. Got a question? Ask it.')
  })

  it('uses consistent Ev Kids ages, availability, and safety details', () => {
    const kidsSection = sourceSection("await upsertPage('kids'", "await upsertPage('youth'")
    const shortCopy =
      'Ev Kids runs every Sunday morning at North and Central for children aged 1 to 12. Careful check-in, matched pick-up, and police-vetted, trained leaders. Allow an extra ten minutes on your first visit.'

    expect(kidsSection).toContain('children aged 1 to 12')
    expect(kidsSection).toContain('Creche (1 to 2 years)')
    expect(kidsSection).toContain('matched pick-up')
    expect(kidsSection).toContain("collection tag must match your child\\'s check-in tag")
    expect(kidsSection).toContain('Allow an extra ten minutes on your first visit')
    expect(seedSource.split(shortCopy)).toHaveLength(3)
    expect(seedSource).not.toMatch(/(?:ages|aged) 0(?: to |-)?12/i)
    expect(seedSource).not.toMatch(/Creche \(0(?: to |-)?2 years\)/i)
    expect(seedSource).not.toContain('during all services')
  })

  it('describes the Good News precisely and points to Explaining Christianity', () => {
    const goodNewsSection = sourceSection(
      "await upsertPage('good-news'",
      "console.log('\\nSeed complete!",
    )

    expect(goodNewsSection).toContain("It's not a set of rules to keep, or a ladder to climb.")
    expect(goodNewsSection).toContain("That's exactly what Explaining Christianity is for.")
    expect(goodNewsSection).not.toContain('not a list of things to believe')
  })

  it('routes Give links through a contextual giving page', () => {
    const givingSection = sourceSection("await upsertPage('give'", "await upsertPage('good-news'")
    const header = readFileSync(
      new URL('../components/layout/Header.tsx', import.meta.url),
      'utf8',
    )
    const footer = readFileSync(
      new URL('../components/layout/Footer.tsx', import.meta.url),
      'utf8',
    )

    expect(givingSection).toContain('Everything we have is given to us by God')
    expect(givingSection).toContain('glad, planned, and free')
    expect(givingSection).toContain("Please don't feel any obligation to give")
    expect(givingSection).toContain("href: 'https://give.ev.church'")
    expect(header).not.toContain('href="https://give.ev.church"')
    expect(header.match(/href="\/give"/g)).toHaveLength(2)
    expect(footer).toContain("{ label: 'Give', href: '/give' }")
  })
})
