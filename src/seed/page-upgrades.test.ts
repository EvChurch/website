import { describe, expect, it } from 'vitest'

import {
  upgradeLegacyAboutPage,
  upgradeLegacyBeliefsPage,
  upgradeLegacyHomePage,
  upgradeLegacyVisitPage,
} from './page-upgrades'

function body(...paragraphs: string[]) {
  return {
    root: {
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        children: [{ type: 'text', text }],
      })),
    },
  }
}

describe('targeted page upgrades', () => {
  it('updates only legacy homepage hero fields and preserves editorial state', () => {
    const document = {
      _status: 'draft',
      seo: {
        metaTitle: 'Church in Auckland | Ev Church | Sunday Services & Community',
        metaDescription: 'Editor description',
      },
      layout: [
        {
          id: 'hero-id',
          blockType: 'hero',
          eyebrow: 'A Christian Evangelical Church in Auckland',
          heading: 'Editor heading',
          subtitle: 'Editor subtitle',
          buttons: [{ label: 'Editor action', href: '/editor', variant: 'primary' }],
          image: 99,
        },
        { id: 'custom-id', blockType: 'content', heading: 'Editor block' },
      ],
    }
    const upgrade = upgradeLegacyHomePage(document, {
      seo: { metaTitle: 'New title' },
      layout: [
        {
          blockType: 'hero',
          eyebrow: 'Welcome to Ev Church',
          semanticH1: false,
          subtitle: 'New subtitle',
          minHeight: '50vh',
          buttons: [{ label: 'Visit' }],
        },
      ],
    })

    expect(upgrade).not.toHaveProperty('_status')
    expect(upgrade?.seo).toEqual({
      metaTitle: 'New title',
      metaDescription: 'Editor description',
    })
    expect(upgrade?.layout).toEqual([
      expect.objectContaining({
        id: 'hero-id',
        heading: 'Editor heading',
        image: 99,
        eyebrow: 'Welcome to Ev Church',
        subtitle: 'Editor subtitle',
        buttons: [{ label: 'Editor action', href: '/editor', variant: 'primary' }],
      }),
      { id: 'custom-id', blockType: 'content', heading: 'Editor block' },
    ])
  })

  it('replaces only the legacy visit walkthrough and augments its managed form', () => {
    const upgrade = upgradeLegacyVisitPage(
      {
        layout: [
          {
            id: 'feature-id',
            blockType: 'featureGrid',
            heading: 'Your first Sunday at Ev',
            description: 'Editor walkthrough description',
            items: [{ title: 'Editor walkthrough item' }],
          },
          { id: 'editor-id', blockType: 'content', heading: 'Editor block' },
          {
            id: 'form-id',
            blockType: 'formEmbed',
            rockWorkflowGuid: 'DE3D06A6-7FCA-41A5-8C37-A485767DE970',
            heading: 'Editor form heading',
          },
        ],
      },
      {
        layout: [
          { blockType: 'featureGrid', heading: 'What actually happens in a service?' },
          { blockType: 'cta', heading: 'Will I be asked to stand up?' },
          {
            blockType: 'formEmbed',
            rockWorkflowGuid: 'de3d06a6-7fca-41a5-8c37-a485767de970',
            description: 'New expectation',
            fallbackContactLabel: 'Message us',
            fallbackContactHref: '/contact',
          },
        ],
      },
    )

    expect(upgrade?.layout).toEqual([
      expect.objectContaining({
        id: 'feature-id',
        heading: 'What actually happens in a service?',
        description: 'Editor walkthrough description',
        items: [{ title: 'Editor walkthrough item' }],
      }),
      expect.objectContaining({ blockType: 'cta' }),
      { id: 'editor-id', blockType: 'content', heading: 'Editor block' },
      expect.objectContaining({ id: 'form-id', heading: 'Editor form heading' }),
    ])
  })

  it('replaces the complete legacy walkthrough and preserves item IDs', () => {
    const legacyItems = [
      {
        id: 'relaxed-id',
        icon: 'smile',
        title: 'Relaxed services',
        description:
          'No dress code. No pressure. Our services run about 75 minutes with live music, a practical message, and time to connect.',
      },
      {
        id: 'kids-id',
        icon: 'graduation',
        title: 'Kids program',
        description:
          'Ev Kids runs every Sunday morning at North and Central for children aged 0 to 12. Careful check-in, matched pick-up, and police-vetted, trained leaders. Allow an extra ten minutes on your first visit.',
      },
      {
        id: 'coffee-id',
        icon: 'coffee',
        title: 'Great coffee',
        description:
          'Arrive a few minutes early and grab a complimentary coffee. Our cafe is a great place to meet people before the service.',
      },
      {
        id: 'community-id',
        icon: 'users',
        title: 'Friendly community',
        description:
          'Our welcome team will help you find a seat, point you to kids check-in, and answer any questions. You will feel at home.',
      },
    ]
    const replacementItems = [
      { icon: 'music', title: '1. We sing.', description: 'New first item.' },
      { icon: 'calendar', title: "2. We hear what's on.", description: 'New second item.' },
      { icon: 'book', title: '3. We open the Bible.', description: 'New third item.' },
      {
        icon: 'coffee',
        title: '4. We sing again, and we eat.',
        description: 'New fourth item.',
      },
    ]

    const upgrade = upgradeLegacyVisitPage(
      {
        layout: [
          {
            id: 'feature-id',
            blockType: 'featureGrid',
            heading: 'Your first Sunday at Ev',
            description:
              'We want you to feel comfortable from the moment you walk in. Here is what you can expect when visiting Ev Church on a Sunday in Auckland.',
            items: legacyItems,
          },
          { id: 'neighbor-id', blockType: 'content', heading: 'Keep me' },
        ],
      },
      {
        layout: [
          {
            blockType: 'featureGrid',
            heading: 'What actually happens in a service?',
            description: 'New walkthrough description.',
            items: replacementItems,
          },
          { blockType: 'cta', heading: 'Will I be asked to stand up?' },
        ],
      },
    )

    expect(upgrade?.layout?.[0]).toEqual(
      expect.objectContaining({
        id: 'feature-id',
        heading: 'What actually happens in a service?',
        description: 'New walkthrough description.',
        items: replacementItems.map((item, index) => ({
          ...item,
          id: legacyItems[index].id,
        })),
      }),
    )
    expect(upgrade?.layout).toContainEqual({
      id: 'neighbor-id',
      blockType: 'content',
      heading: 'Keep me',
    })
  })

  it('appends the team invitation without replacing existing rich text', () => {
    const upgrade = upgradeLegacyAboutPage(
      {
        layout: [
          {
            id: 'team-intro',
            blockType: 'content',
            body: body(
              'Editor introduction',
              'While every member of Ev Church is called to serve, leaders equip the church.',
            ),
          },
        ],
      },
      {
        layout: [
          {
            blockType: 'content',
            body: body('Seeded paragraph', 'Every email below is real and read. Got a question? Ask it.'),
          },
        ],
      },
    )

    expect(JSON.stringify(upgrade?.layout)).toContain('Editor introduction')
    expect(JSON.stringify(upgrade?.layout)).toContain('Every email below is real and read')
  })

  it('extends only unchanged belief statements and preserves custom accordion answers', () => {
    const oldSalvation = 'Salvation legacy text.'
    const upgrade = upgradeLegacyBeliefsPage(
      {
        layout: [
          {
            blockType: 'pageHeader',
            description:
              'Ev Church is an evangelical church that is independent in governance but united with Christians around the world and throughout history in upholding the gospel of Jesus Christ. We hold the Bible to be the supreme authority in all matters of faith and conduct and weigh all our teaching against its standard.',
          },
          {
            blockType: 'content',
            heading: 'Our foundational convictions',
            body: body('Editor conviction wording'),
          },
          {
            blockType: 'accordion',
            heading: 'What we believe',
            items: [
              { question: 'About Salvation', answer: oldSalvation },
              { question: 'About the Church', answer: 'Editor answer' },
            ],
          },
        ],
      },
      {
        layout: [
          { blockType: 'pageHeader', description: 'The short version is a person.' },
          {
            blockType: 'content',
            heading: 'Our foundational convictions',
            body: body('Ev Church is an evangelical church.', 'Seeded conviction'),
          },
          {
            blockType: 'accordion',
            heading: 'What we believe',
            items: [
              { question: 'About Salvation', answer: `${oldSalvation} Added hope.` },
              { question: 'About the Church', answer: 'Original answer. Added leadership.' },
            ],
          },
        ],
      },
    )

    expect(JSON.stringify(upgrade?.layout)).toContain('Editor conviction wording')
    expect(JSON.stringify(upgrade?.layout)).toContain('Added hope')
    expect(JSON.stringify(upgrade?.layout)).toContain('Editor answer')
  })
})
