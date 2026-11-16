import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import type { ContentBlock, Page } from '@/payload-types'

type PageLayout = NonNullable<Page['layout']>

function paragraph(text: string, italic = false): ContentBlock['body'] {
  return { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [
    { type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', children: [
      { type: 'text', text, format: italic ? 2 : 0, detail: 0, mode: 'normal', style: '', version: 1 },
    ] },
  ] } }
}

const readyToGive = {
  blockType: 'cta', heading: 'Ready to give?', colorPreset: 'light',
  buttons: [{ label: '→ give.ev.church', href: 'https://give.ev.church', variant: 'primary' }],
} satisfies PageLayout[number]

// The MCP pages surface supports find/update, but no create operation. Create
// these documents once via the normal deployment migration; later edits use MCP.
// Never replace an existing page, including an unpublished draft.
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const existing = await payload.find({
    collection: 'pages', req, depth: 0, limit: 2, draft: true,
    select: { slug: true },
    where: { slug: { in: ['generosity', 'generosity-budgeting'] } },
  })
  const slugs = new Set(existing.docs.map((page) => page.slug))
  if (!slugs.has('generosity')) {
    const home = await payload.find({
      collection: 'pages', req, depth: 0, limit: 1,
      where: { slug: { equals: 'home' } }, select: { layout: true },
    })
    const homeHero = home.docs[0]?.layout?.find((block) => block.blockType === 'hero')
    const image = homeHero?.image
    const heading = 'Grow in generosity'
    const subtitle = "Everything we have is God's. Here's a simple place to think through what that means for your money and your giving."
    const hero: PageLayout[number] = image ? {
      blockType: 'hero', image: typeof image === 'number' ? image : image.id,
      eyebrow: 'Generosity at Ev', heading, subtitle, minHeight: '50vh',
      buttons: [
        { label: 'Work out my giving', href: '/generosity/calculator', variant: 'primary' },
        { label: 'Give now', href: 'https://give.ev.church', variant: 'secondary' },
      ],
    } : { blockType: 'pageHeader', heading, description: subtitle, theme: 'light' }
    const layout: PageLayout = [
      hero,
      {
        "blockType": "featureGrid",
        "heading": "Why we give",
        "description": "At Ev, giving isn’t a membership fee or a fundraising target. It’s part of following Jesus, who “though he was rich, yet for your sake became poor” (2 Cor 8:9). Here’s how the Bible shapes the way we think about money.",
        "layout": "threeColumn",
        "style": "iconTop",
        "items": [
          {
            "title": "God owns it all.",
            "description": "We’re managers, not owners. “Everything comes from you, and we have given you only what comes from your hand” (1 Chr 29:14)."
          },
          {
            "title": "You can’t take it with you, but you can send it ahead.",
            "description": "Money spent on ourselves stays here. Money given to God’s work is stored up in heaven (Matt 6:19–20)."
          },
          {
            "title": "Your heart follows your money.",
            "description": "“Where your treasure is, there your heart will be also” (Matt 6:21). If you want to care more about God’s kingdom, put your money there."
          },
          {
            "title": "This world isn’t home.",
            "description": "We’re citizens of heaven (Phil 3:20), so we hold earthly things loosely and invest in what lasts."
          },
          {
            "title": "God gives us more so we can give more.",
            "description": "When God increases what we have, it’s not only to raise our standard of living but our standard of giving (2 Cor 9:8–11)."
          },
          {
            "title": "Giving breaks money’s grip.",
            "description": "Generosity is God’s antidote to materialism. It frees us to “take hold of the life that is truly life” (1 Tim 6:17–19)."
          }
        ]
      },
      {
        "blockType": "content",
        "alignment": "left",
        "body": paragraph('These ideas are drawn from Randy Alcorn’s The Treasure Principle, a short book we’d encourage everyone to read.', true)
      },
      {
        "blockType": "manualCardGrid",
        "heading": "Where to start: three steps",
        "cardStyle": "info",
        "columns": "3",
        "cards": [
          {
            "title": "1. Work out my giving",
            "description": "See what you’re giving now as a share of your income, and what a next step could look like. It runs entirely on your device, so nothing you enter is saved or seen.",
            "href": "/generosity/calculator",
            "linkLabel": "Open the giving calculator"
          },
          {
            "title": "2. Get your budget in order",
            "description": "Giving well starts with knowing where your money goes. This short course walks you through setting up a simple budget.",
            "href": "/generosity-budgeting",
            "linkLabel": "Start the budgeting course"
          },
          {
            "title": "3. Go deeper",
            "description": "Want to think more about money, debt, saving and contentment from a Christian point of view? A longer course is on its way.",
            "linkLabel": "Coming soon"
          }
        ]
      },
      {
        "blockType": "cta",
        "heading": "Giving at Ev",
        "text": "We encourage you to give first to your local church, the family where you’re fed and cared for (Gal 6:6), and then beyond it to other gospel work and to the poor. Give regularly, cheerfully and not under pressure: “God loves a cheerful giver” (2 Cor 9:7). You can claim back a third of what you give to registered NZ charities each year through the donation tax credit.",
        "colorPreset": "light",
        "buttons": [
          {
            "label": "Give at give.ev.church",
            "href": "https://give.ev.church",
            "variant": "primary"
          }
        ]
      },
      readyToGive,
    ]
    if (!image) layout.splice(1, 0, {
      blockType: 'cta', heading: 'Work out my giving', colorPreset: 'light',
      buttons: [
        { label: 'Open the giving calculator', href: '/generosity/calculator', variant: 'primary' },
        { label: 'Give now', href: 'https://give.ev.church', variant: 'secondary' },
      ],
    })
    await payload.create({
      collection: 'pages', req, context: { skipCacheInvalidation: true },
      data: { title: heading, slug: 'generosity', _status: 'published', template: 'standard', layout,
        seo: { metaTitle: 'Grow in generosity | Ev Church', metaDescription: subtitle } },
    })
  }
  if (!slugs.has('generosity-budgeting')) {
    await payload.create({
      collection: 'pages', req, context: { skipCacheInvalidation: true },
      data: {
        title: 'Get your budget in order', slug: 'generosity-budgeting', _status: 'published', template: 'standard',
        seo: { metaDescription: 'A simple budgeting course to help you think through where your money goes. Course details coming soon.' },
        layout: [
          { blockType: 'pageHeader', heading: 'Get your budget in order', theme: 'light', description: 'Giving well starts with knowing where your money goes. This short course walks you through setting up a simple budget.' },
          { blockType: 'content', heading: 'Course details coming soon', alignment: 'left', body: paragraph('We’re choosing the budgeting course we’ll use. The course link will be available here once it’s confirmed.') },
          { blockType: 'cta', heading: 'Keep growing in generosity', colorPreset: 'light', buttons: [
            { label: 'Back to generosity', href: '/generosity', variant: 'secondary' },
            { label: 'Give now', href: 'https://give.ev.church', variant: 'primary' },
          ] },
          readyToGive,
        ],
      },
    })
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Preserve pages and any subsequent editor changes on rollback.
}
