import { getPayload } from 'payload'
import config from '@payload-config'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Build a simple Lexical root with one or more paragraphs. */
function richText(paragraphs: string | string[]) {
  const texts = Array.isArray(paragraphs) ? paragraphs : [paragraphs]
  return {
    root: {
      type: 'root',
      children: texts.map((t) => ({
        type: 'paragraph',
        children: [{ type: 'text', text: t, version: 1 }],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      })),
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Image manifest                                                    */
/* ------------------------------------------------------------------ */

interface ImageEntry {
  key: string
  filePath: string
  alt: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const IMAGES_ROOT = resolve(__dirname, '../../public/images')

const imageManifest: ImageEntry[] = [
  // Homepage carousel images
  { key: 'carousel-0c59a44d', filePath: 'homepage/carousel-0c59a44d.jpg', alt: 'Sunday morning community gathering at Ev Church Auckland' },
  { key: 'carousel-146c7f7e', filePath: 'homepage/carousel-146c7f7e.jpg', alt: 'Community celebration at Ev Church Auckland' },
  { key: 'carousel-168f386e', filePath: 'homepage/carousel-168f386e.jpg', alt: 'Kids enjoying activities at Ev Church Auckland Sunday service' },
  { key: 'carousel-168f386e', filePath: 'homepage/carousel-168f386e.jpg', alt: 'Community life at Ev Church Auckland' },
  { key: 'carousel-3c68ddf1', filePath: 'homepage/carousel-3c68ddf1.jpg', alt: 'Families connecting at Ev Church Auckland' },
  { key: 'carousel-3c68ddf1', filePath: 'homepage/carousel-3c68ddf1.jpg', alt: 'People connecting after Sunday service at Ev Church Auckland' },
  { key: 'carousel-5940ca71', filePath: 'homepage/carousel-5940ca71.jpg', alt: 'Friends laughing together at Ev Church Auckland community' },
  { key: 'carousel-c645786c', filePath: 'homepage/carousel-c645786c.jpg', alt: 'Live worship at Ev Church Auckland Sunday service' },
  { key: 'carousel-70ac2785', filePath: 'homepage/carousel-70ac2785.jpg', alt: 'Ev Church North campus in Rosedale Auckland' },
  { key: 'carousel-79cef650', filePath: 'homepage/carousel-79cef650.jpg', alt: 'Children at Ev Kids program Auckland' },
  { key: 'carousel-89a3395d', filePath: 'homepage/carousel-89a3395d.jpg', alt: 'Warm community at Ev Church Auckland' },
  { key: 'carousel-8aae1142', filePath: 'homepage/carousel-8aae1142.jpg', alt: 'People laughing together at Ev Church Auckland' },
  { key: 'carousel-9a8d8943', filePath: 'homepage/carousel-9a8d8943.jpg', alt: 'Community gathering at Ev Church Auckland' },
  { key: 'carousel-aea4638f', filePath: 'homepage/carousel-aea4638f.jpg', alt: 'Families and children at Ev Church Auckland' },
  { key: 'carousel-c645786c', filePath: 'homepage/carousel-c645786c.jpg', alt: 'People enjoying fellowship at Ev Church Auckland' },
  { key: 'carousel-c842f7b4', filePath: 'homepage/carousel-c842f7b4.jpg', alt: 'Warm community gathering at Ev Church Auckland' },
  { key: 'carousel-9a8d8943', filePath: 'homepage/carousel-9a8d8943.jpg', alt: 'People laughing together at Ev Church Auckland Sunday service' },
  { key: 'carousel-db9ac570', filePath: 'homepage/carousel-db9ac570.jpg', alt: 'Small group discussion at Ev Church Auckland' },

  // Campus images
  { key: 'central-photo-1', filePath: 'campus-central/photo-3b4be562.jpg', alt: 'Ev Church Central campus in Hillsborough Auckland' },
  { key: 'unichurch-photo-1', filePath: 'campus-unichurch/photo-3cb597b9.jpg', alt: 'Unichurch student campus at University of Auckland' },

  // Kids
  { key: 'ev-kids-banner', filePath: 'kids/ev-kids-banner.png', alt: 'Children enjoying Ev Kids Sunday program at Ev Church Auckland' },

  // Youth
  { key: 'ev-youth-banner', filePath: 'youth/ev-youth-banner.png', alt: 'Ev Youth community of teenagers in Auckland' },
  { key: 'youthleaders-all', filePath: 'youth/youthleaders-all.jpg', alt: 'Ev Youth leaders team at Ev Church Auckland' },
  { key: 'youthleaders-fun', filePath: 'youth/youthleaders-fun.jpg', alt: 'Youth leaders having fun together at Ev Church Auckland' },
  { key: 'youthleaders-junior1', filePath: 'youth/youthleaders-junior1.jpg', alt: 'Junior Youth leaders at Ev Church Auckland' },
  { key: 'youthleaders-senior', filePath: 'youth/youthleaders-senior.jpg', alt: 'Senior Youth leaders at Ev Church Auckland' },

  // Newish
  { key: 'newish-connect-banner', filePath: 'newish/newish-connect-banner.jpg', alt: 'People connecting at Newish Connect event at Ev Church Auckland' },

  // Explaining Christianity
  { key: 'ec-banner', filePath: 'explaining-christianity/explaining-christianity-banner.jpg', alt: 'People gathered for Explaining Christianity course at Ev Church Auckland' },

  // Connect Groups
  { key: 'connect-groups-banner', filePath: 'connect-groups/connect-groups-banner.jpg', alt: 'People gathered in a Connect Group at Ev Church Auckland' },

  // Good News page (Unsplash)
  { key: 'gn-hero', filePath: 'good-news/hero-worship.jpg', alt: 'People raising their hands during a worship gathering' },
  { key: 'gn-stars', filePath: 'good-news/stars-wonder.jpg', alt: 'Person gazing up at the stars on a clear night' },
  { key: 'gn-compassion', filePath: 'good-news/compassion-hands.jpg', alt: 'A comforting hand on someone\'s shoulder' },
  { key: 'gn-sunrise', filePath: 'good-news/mountain-sunrise.jpg', alt: 'Golden sunrise breaking over mountain peaks' },
  { key: 'gn-coffee', filePath: 'good-news/coffee-conversation.jpg', alt: 'People gathered outside a coffee shop at night' },
  { key: 'gn-studying', filePath: 'good-news/studying-together.jpg', alt: 'Two women studying together at a table' },
  { key: 'gn-family', filePath: 'good-news/family-park.jpg', alt: 'Family walking together in a park' },
  { key: 'gn-care', filePath: 'good-news/community-care.jpg', alt: 'Elderly woman in wheelchair talking with a carer' },
  { key: 'gn-ocean', filePath: 'good-news/ocean-reflection.jpg', alt: 'Group of women watching the moon over the ocean' },
  { key: 'gn-worship', filePath: 'good-news/worship-gathering.jpg', alt: 'People standing together during a church service' },
  { key: 'gn-alone-rain', filePath: 'good-news/alone-rain.jpg', alt: 'Person with umbrella walking down a rain-lit alley at night' },
  { key: 'gn-light-clouds', filePath: 'good-news/light-through-clouds.jpg', alt: 'Sunlight streaming through dark clouds over the ocean' },

  // Team photos
  { key: 'team-rowan', filePath: 'team/rowan-hilsden.jpg', alt: 'Rowan Hilsden, Senior Pastor at Ev Church Auckland' },
  { key: 'team-andrew', filePath: 'team/andrew-coombridge.jpg', alt: 'Andrew Coombridge, Pastor at Ev Church Auckland' },
  { key: 'team-ryan', filePath: 'team/ryan-green.jpg', alt: 'Ryan Green, Pastor at Ev Church Auckland' },
  { key: 'team-austin', filePath: 'team/austin-ibarra.jpg', alt: 'Austin Ibarra, Pastor at Ev Church Auckland' },
  { key: 'team-ming', filePath: 'team/ming-yong.jpg', alt: 'Ming Yong, Pastor & Kids Coordinator at Ev Church Auckland' },
  { key: 'team-steve', filePath: 'team/steve-mullins.jpg', alt: 'Steve Mullins, Executive Manager at Ev Church Auckland' },
  { key: 'team-jared', filePath: 'team/jared-stevenson.jpg', alt: 'Jared Stevenson, Captivate Music Director at Ev Church Auckland' },
  { key: 'team-ioana', filePath: 'team/ioana-selea.jpg', alt: 'Ioana Selea, Design and Social at Ev Church Auckland' },
  { key: 'team-tim', filePath: 'team/tim-thang.jpg', alt: 'Tim Thang, Executive Assistant at Ev Church Auckland' },
  { key: 'team-liz', filePath: 'team/liz-halliday.jpg', alt: 'Liz Halliday, Apprentice' },
  { key: 'team-shaun', filePath: 'team/shaun-ee.jpg', alt: 'Shaun Ee, Apprentice' },
  { key: 'team-manlong', filePath: 'team/man-long-cheung.jpg', alt: 'Man Long Cheung, Apprentice' },
  { key: 'team-tina', filePath: 'team/tina-mao.jpg', alt: 'Tina Mao, Apprentice' },
  { key: 'team-serena', filePath: 'team/serena-lau.jpg', alt: 'Serena Lau, Apprentice' },
]

/* ------------------------------------------------------------------ */
/*  Main seed function                                                */
/* ------------------------------------------------------------------ */

async function seed() {
  const payload = await getPayload({ config })
  const mediaMap = new Map<string, number>()

  /* ======================== Upload images ========================= */
  console.log('Uploading images...')

  for (const entry of imageManifest) {
    const fullPath = join(IMAGES_ROOT, entry.filePath)
    if (!existsSync(fullPath)) {
      console.warn(`  Skipping missing file: ${entry.filePath}`)
      continue
    }

    // Check if already uploaded by alt text match
    const existing = await payload.find({
      collection: 'media',
      where: { alt: { equals: entry.alt } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      mediaMap.set(entry.key, existing.docs[0].id as number)
      console.log(`  Exists: ${entry.key} (id: ${existing.docs[0].id})`)
      continue
    }

    try {
      const doc = await payload.create({
        collection: 'media',
        data: { alt: entry.alt },
        filePath: fullPath,
      })
      mediaMap.set(entry.key, doc.id as number)
      console.log(`  Uploaded: ${entry.key} (id: ${doc.id})`)
    } catch (err) {
      console.error(`  Failed to upload ${entry.key}:`, err)
    }
  }

  /** Get a media ID from the map, with a fallback to the first available image. */
  function img(key: string): number {
    const id = mediaMap.get(key)
    if (id) return id
    // Fallback to first available image
    const fallback = mediaMap.values().next().value
    console.warn(`  Warning: no media for "${key}", using fallback id ${fallback}`)
    return fallback ?? 1
  }

  /* ======================== Seed pages ============================ */

  /** Upsert helper: find by slug, update or create. */
  async function upsertPage(slug: string, data: Record<string, unknown>) {
    const existing = await payload.find({
      collection: 'pages',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      console.log(`  Updating page: ${slug}`)
      await payload.update({
        collection: 'pages',
        id: existing.docs[0].id,
        data,
      })
    } else {
      console.log(`  Creating page: ${slug}`)
      await payload.create({
        collection: 'pages',
        data: { slug, ...data },
      })
    }
  }

  /* ─────────────────────── HOME PAGE ─────────────────────── */
  console.log('\nSeeding pages...')
  await upsertPage('home', {
    title: 'Home',
    _status: 'published',
    layout: [
      {
        blockType: 'hero',
        image: img('carousel-0c59a44d'),
        eyebrow: 'A Christian Evangelical Church in Auckland',
        heading: 'A place to belong',
        semanticH1: true,
        highlightedText: 'belong',
        subtitle: 'Ev Church is a community of Christ-followers across Auckland. Whether you are exploring faith for the first time or have been part of a church for years, you are welcome here.',
        supportingText: 'Ev Church is a Christian church in Tāmaki Makaurau (Auckland), New Zealand. We meet across multiple campuses each Sunday, helping people follow Jesus, grow in faith, and become part of a welcoming community.',
        overlayStyle: 'leftToRight',
        minHeight: '85vh',
        buttons: [
          { label: 'Plan Your Visit', href: '/visit', variant: 'primary' },
          { label: 'Learn about us', href: '/about', variant: 'text' },
        ],
      },
      {
        blockType: 'latestSermon',
        heading: 'Latest Sermon',
      },
      {
        blockType: 'content',
        heading: 'A Christian church across Auckland',
        body: richText(
          'We meet every Sunday at three campuses across the city. Our services are relaxed, family-friendly, and filled with live worship, an engaging message, and genuine community. Beyond Sundays, we have Connect Groups, programs for kids and youth, and courses for anyone curious about faith.',
        ),
        alignment: 'center',
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('carousel-3c68ddf1') },
          { image: img('carousel-c645786c') },
          { image: img('carousel-168f386e') },
          { image: img('carousel-9a8d8943') },
          { image: img('carousel-db9ac570') },
          { image: img('carousel-79cef650') },
          { image: img('carousel-89a3395d') },
          { image: img('carousel-8aae1142') },
        ],
      },
      {
        blockType: 'featureGrid',
        eyebrow: 'New here?',
        heading: 'What to expect on a Sunday',
        description: 'Whether it is your first time at church or you have been going for years, you are welcome at Ev.',
        layout: 'twoColumn',
        style: 'iconLeft',
        items: [
          {
            icon: 'clock',
            title: 'Sunday 10:15 am',
            description: 'North and Central campuses meet at 10:15 am. Unichurch meets at 5:15 pm. Services run for about 75 minutes.',
          },
          {
            icon: 'smile',
            title: 'Come as you are',
            description: 'No dress code, no pressure. Just a warm, welcoming community ready to meet you. Grab a coffee before the service.',
          },
          {
            icon: 'heart',
            title: 'Great for families',
            description: 'Ev Kids runs every Sunday for ages 0-12 at North and Central. Safe, fun, and engaging programs for every age group.',
          },
          {
            icon: 'users',
            title: 'Find your people',
            description: 'Connect Groups meet throughout the week across Auckland. Young adults, couples, women, men, and families.',
          },
        ],
      },
      {
        blockType: 'manualCardGrid',
        eyebrow: 'Three campuses',
        heading: 'Join us this Sunday',
        cardStyle: 'imageOverlay',
        columns: '3',
        cards: [
          {
            image: img('carousel-70ac2785'),
            eyebrow: 'Rosedale, Auckland',
            title: 'North',
            subtitle: 'Sunday 10:15 am',
            address: '9-11 Rothwell Avenue, Rosedale',
            href: '/campus/north',
            linkLabel: 'Learn more about North Campus',
          },
          {
            image: img('central-photo-1'),
            eyebrow: 'Hillsborough, Auckland',
            title: 'Central',
            subtitle: 'Sunday 10:15 am',
            address: '80 Olsen Avenue, Hillsborough',
            href: '/campus/central',
            linkLabel: 'Learn more about Central Campus',
          },
          {
            image: img('unichurch-photo-1'),
            eyebrow: 'University of Auckland',
            title: 'Unichurch',
            subtitle: 'Sunday 5:15 pm',
            address: '24 Princes Street, Auckland',
            href: '/campus/unichurch',
            linkLabel: 'Learn more about Unichurch',
          },
        ],
      },
      {
        blockType: 'content',
        heading: '*Captivated* by Christ, *grounded* in the gospel, *growing* in maturity and number',
        body: richText(
          'We are a bunch of people, convinced we are not perfect, captivated by the historical Jesus, excited about the future he offers, and eager to authentically share this hope with Auckland, New Zealand and the world.',
        ),
        alignment: 'center',
      },
      {
        blockType: 'manualCardGrid',
        eyebrow: 'Get connected',
        heading: 'Your next step',
        cardStyle: 'imageTop',
        columns: '3',
        cards: [
          {
            image: img('ec-banner'),
            title: 'Explaining Christianity',
            description: 'A relaxed, no-pressure course exploring the basics of the Christian faith over several weeks.',
            href: '/explaining-christianity',
            linkLabel: 'Learn more about Explaining Christianity',
          },
          {
            image: img('connect-groups-banner'),
            title: 'Connect Groups',
            description: 'Small groups that meet during the week. A place to build real friendships and grow together.',
            href: '/connect-groups',
            linkLabel: 'Find a Connect Group near you',
          },
          {
            image: img('newish-connect-banner'),
            title: 'Newish Connect',
            description: 'New to Ev? This short course helps you meet people and find your place in the community.',
            href: '/newish',
            linkLabel: 'Learn more about Newish Connect',
          },
        ],
      },
      {
        blockType: 'cta',
        heading: 'Everyone is welcome',
        text: 'We would love to meet you. Come as you are. No dress code, no expectations. Just a warm community ready to welcome you.',
        supportingText: 'Planning to visit a church in Auckland? Here is what to expect when you join us on Sunday.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Find a campus near you', href: '/visit', variant: 'primary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'Church in Auckland | Ev Church | Sunday Services & Community',
      metaDescription: 'Looking for a church in Auckland? Ev Church is a community of Christ-followers meeting across Tamaki Makaurau. Join us this Sunday.',
    },
  })

  /* ─────────────────────── VISIT PAGE ─────────────────────── */
  await upsertPage('visit', {
    title: 'Visit',
    _status: 'published',
    layout: [
      {
        blockType: 'hero',
        image: img('carousel-146c7f7e'),
        eyebrow: 'Plan your visit',
        heading: 'Come as you are',
        highlightedText: 'you are',
        subtitle: 'Whether it is your first time at church or you have been going for years, you are welcome at Ev. If you are looking for a church in Auckland, we would love to meet you this Sunday.',
        supportingText: 'Ev Church is a Christian church in Tāmaki Makaurau (Auckland), New Zealand, with campuses across the city meeting each Sunday.',
        overlayStyle: 'leftToRight',
        minHeight: '70vh',
      },
      {
        blockType: 'featureGrid',
        eyebrow: 'What to expect',
        heading: 'Your first Sunday at Ev',
        description: 'We want you to feel comfortable from the moment you walk in. Here is what you can expect when visiting Ev Church on a Sunday in Auckland.',
        style: 'iconLeft',
        items: [
          {
            icon: 'smile',
            title: 'Relaxed services',
            description: 'No dress code. No pressure. Our services run about 75 minutes with live music, a practical message, and time to connect.',
          },
          {
            icon: 'graduation',
            title: 'Kids program',
            description: 'Ev Kids runs during every service at North and Central for ages 1 to 12. Safe, fun, and age-appropriate. Your kids will love it.',
          },
          {
            icon: 'coffee',
            title: 'Great coffee',
            description: 'Arrive a few minutes early and grab a complimentary coffee. Our cafe is a great place to meet people before the service.',
          },
          {
            icon: 'users',
            title: 'Friendly community',
            description: 'Our welcome team will help you find a seat, point you to kids check-in, and answer any questions. You will feel at home.',
          },
        ],
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('carousel-3c68ddf1') },
          { image: img('carousel-c645786c') },
          { image: img('carousel-168f386e') },
          { image: img('carousel-9a8d8943') },
          { image: img('carousel-db9ac570') },
          { image: img('carousel-79cef650') },
        ],
      },
      {
        blockType: 'manualCardGrid',
        eyebrow: 'Three campuses',
        heading: 'Find a campus near you',
        description: 'We gather across Tāmaki Makaurau each Sunday, with campuses in Rosedale, Hillsborough, and at the University of Auckland.',
        cardStyle: 'imageOverlay',
        columns: '3',
        cards: [
          {
            image: img('carousel-70ac2785'),
            eyebrow: 'Rosedale, Auckland',
            title: 'North',
            subtitle: 'Sunday 10:15 am',
            address: '9-11 Rothwell Avenue, Rosedale',
            href: '/campus/north',
            linkLabel: 'Learn more about North Campus',
          },
          {
            image: img('central-photo-1'),
            eyebrow: 'Hillsborough, Auckland',
            title: 'Central',
            subtitle: 'Sunday 10:15 am',
            address: '80 Olsen Avenue, Hillsborough',
            href: '/campus/central',
            linkLabel: 'Learn more about Central Campus',
          },
          {
            image: img('unichurch-photo-1'),
            eyebrow: 'University of Auckland',
            title: 'Unichurch',
            subtitle: 'Sunday 5:15 pm',
            address: '24 Princes Street, Auckland',
            href: '/campus/unichurch',
            linkLabel: 'Learn more about Unichurch',
          },
        ],
      },
      {
        blockType: 'cta',
        heading: 'We would love to meet you',
        text: 'Have questions before visiting? Get in touch and we will help with anything you need, from finding the right campus to knowing what to expect on Sunday.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Get in touch', href: '/contact', variant: 'primary' },
          { label: 'Learn more about Ev Church', href: '/about', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'Visit Ev Church Auckland | Plan Your First Sunday',
      metaDescription: 'Planning your first visit to Ev Church? Find service times, locations, parking info, and what to expect at our Auckland campuses.',
    },
  })

  /* ─────────────────────── ABOUT PAGE ─────────────────────── */
  await upsertPage('about', {
    title: 'About',
    _status: 'published',
    layout: [
      {
        blockType: 'hero',
        image: img('carousel-70ac2785'),
        eyebrow: 'Established in 2012',
        heading: 'Our story',
        highlightedText: 'story',
        subtitle: 'Captivated by Christ, grounded in the gospel, and growing in maturity and number.',
        overlayStyle: 'leftToRight',
        minHeight: '70vh',
      },
      {
        blockType: 'content',
        heading: 'Our *mission*',
        body: richText([
          'Our mission is to magnify God\'s glory, seen most clearly in Jesus. Everything we do flows from this Christ-centred purpose.',
          'We exist to connect authentically with both the world and the church, share the good news of Jesus with the lost, mature in our love and knowledge of God, equip the next generation of gospel workers, and plant a network of grounded and growing churches throughout Auckland and New Zealand.',
          'We anticipate that God\'s word will transform the hearts and minds of many Aucklanders, forming the basis of a growing church that equips and trains gospel workers, supports and plants more churches, all for the glory of God.',
        ]),
        alignment: 'center',
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('carousel-9a8d8943') },
          { image: img('carousel-0c59a44d') },
          { image: img('carousel-146c7f7e') },
          { image: img('carousel-c645786c') },
          { image: img('carousel-db9ac570') },
        ],
      },
      {
        blockType: 'content',
        heading: '*Every* member ministry',
        body: richText([
          "At Ev Church, the ministry team is never just the paid pastors and staff. We believe that God has given every Christian the gifts and opportunities to serve their fellow Christians and the community around them. You could even say that we are all gifts to our fellow brothers and sisters in Christ here at church.",
          "The phrase we use is \"every member ministry\". We want to see everyone at Ev Church, week-in and week-out, use who God has made them to be to love one another, pray for one another, serve, provide, train, and teach. Ev Church is a church where everyone is part of the ministry team.",
          "While every member of Ev Church is called to serve, God has also set apart a team to lead, equip, and support the church family. These are the people who give their working week to shepherding, teaching, and building the life of the church so that every member can flourish in their gifts.",
        ]),
        alignment: 'center',
      },
      {
        blockType: 'manualCardGrid',
        eyebrow: 'Our people',
        heading: 'Meet the team',
        description: 'Pastors',
        cardStyle: 'imageTop',
        columns: '3',
        cards: [
          { image: img('team-rowan'), title: 'Rowan Hilsden', subtitle: 'Senior Pastor', details: [{ label: 'Email', value: 'rowan.hilsden@ev.church' }] },
          { image: img('team-andrew'), title: 'Andrew Coombridge', subtitle: 'Pastor', details: [{ label: 'Email', value: 'andrew.coombridge@ev.church' }] },
          { image: img('team-ryan'), title: 'Ryan Green', subtitle: 'Pastor', details: [{ label: 'Email', value: 'ryan.green@ev.church' }] },
          { image: img('team-austin'), title: 'Austin Ibarra', subtitle: 'Pastor', details: [{ label: 'Email', value: 'austin.ibarra@ev.church' }] },
          { image: img('team-ming'), title: 'Ming Yong', subtitle: 'Pastor & Kids Coordinator', details: [{ label: 'Email', value: 'ming.yong@ev.church' }] },
        ],
      },
      {
        blockType: 'manualCardGrid',
        description: 'Staff',
        cardStyle: 'imageTop',
        columns: '3',
        cards: [
          { image: img('team-steve'), title: 'Steve Mullins', subtitle: 'Executive Manager', details: [{ label: 'Email', value: 'steve.mullins@ev.church' }] },
          { image: img('team-jared'), title: 'Jared Stevenson', subtitle: 'Captivate Music Director', details: [{ label: 'Email', value: 'jared.stevenson@ev.church' }] },
          { image: img('team-ioana'), title: 'Ioana Selea', subtitle: 'Design and Social', details: [{ label: 'Email', value: 'ioana.selea@ev.church' }] },
          { image: img('team-tim'), title: 'Tim Thang', subtitle: 'Executive Assistant', details: [{ label: 'Email', value: 'tim.thang@ev.church' }] },
        ],
      },
      {
        blockType: 'manualCardGrid',
        description: 'Apprentices',
        cardStyle: 'imageTop',
        columns: '3',
        cards: [
          { image: img('team-liz'), title: 'Liz Halliday', subtitle: 'Apprentice', details: [{ label: 'Email', value: 'liz.halliday@ev.church' }] },
          { image: img('team-shaun'), title: 'Shaun Ee', subtitle: 'Apprentice', details: [{ label: 'Email', value: 'shaun.ee@ev.church' }] },
          { image: img('team-manlong'), title: 'Man Long Cheung', subtitle: 'Apprentice', details: [{ label: 'Email', value: 'manlong.cheung@ev.church' }] },
          { image: img('team-tina'), title: 'Tina Mao', subtitle: 'Apprentice', details: [{ label: 'Email', value: 'tina.mao@ev.church' }] },
          { image: img('team-serena'), title: 'Serena Lau', subtitle: 'Apprentice', details: [{ label: 'Email', value: 'serena.lau@ev.church' }] },
        ],
      },
      {
        blockType: 'content',
        heading: 'What we believe',
        body: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Ev Church is an evangelical church grounded in the gospel of Jesus Christ. We hold the Bible to be the supreme authority in all matters of faith and conduct, and we stand united with Christians around the world and throughout history.', version: 1 }],
                direction: 'ltr' as const,
                format: '' as const,
                indent: 0,
                version: 1,
              },
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'link',
                    children: [{ type: 'text', text: 'Read more about our core beliefs', version: 1 }],
                    direction: 'ltr' as const,
                    format: '' as const,
                    indent: 0,
                    version: 3,
                    fields: {
                      linkType: 'custom',
                      url: '/what-we-believe',
                      newTab: false,
                    },
                  },
                  { type: 'text', text: ', including what we believe about God, Jesus Christ, the Bible, salvation, the Holy Spirit, and the church.', version: 1 },
                ],
                direction: 'ltr' as const,
                format: '' as const,
                indent: 0,
                version: 1,
              },
            ],
            direction: 'ltr' as const,
            format: '' as const,
            indent: 0,
            version: 1,
          },
        },
        alignment: 'center',
        buttons: [
          { label: 'What we believe', href: '/what-we-believe', variant: 'primary' },
        ],
      },
      {
        blockType: 'cta',
        heading: 'Come and see for yourself',
        text: 'The best way to get to know us is to join us on a Sunday. We would love to welcome you.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Plan your visit', href: '/visit', variant: 'primary' },
          { label: 'Contact us', href: '/contact', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'About Ev Church | Christian Community in Auckland',
      metaDescription: 'Meet the Ev Church team and learn about our story. A Christ-centred community across Auckland, Tamaki Makaurau since 2012.',
    },
  })

  /* ─────────────────────── VISION PAGE ─────────────────────── */
  await upsertPage('vision', {
    title: 'Vision',
    _status: 'published',
    layout: [
      {
        blockType: 'hero',
        image: img('carousel-9a8d8943'),
        eyebrow: 'Our 2030 vision',
        heading: 'Grow. Plant. Train. Build.',
        highlightedText: 'Train. Build.',
        subtitle: 'We are asking God to do four big things in and through us by the year 2030. They are big things, but they are great things.',
        overlayStyle: 'cinematic',
        minHeight: '80vh',
      },
      {
        blockType: 'content',
        heading: '*Captivated* by Christ, *grounded* in the gospel, *growing* in maturity and number',
        body: richText(
          'It is our prayer that God would see the people of Auckland, New Zealand and the world captivated by Christ, grounded in the gospel, growing in maturity and number. From our very beginning we have been passionately and prayerfully committed to magnifying the glory of God, connecting authentically with the world and the church, sharing the good news of Jesus with the lost, and equipping the next generation of gospel workers.',
        ),
        alignment: 'center',
      },
      {
        blockType: 'content',
        heading: '120,000 more Aucklanders trusting in Jesus',
        body: richText([
          'When we started, around 2-3% of Auckland trusted in Jesus. That was 30,000 people. We are praying God would increase that to 150,000 people, 10% of Auckland, in bible-believing, missional churches.',
          'Why 10%? Because when a minority group reaches 10% of a population, the way that group is viewed within society changes. And because God has done it before. Through history\'s most reluctant prophet Jonah, God chose to save 120,000 people in Nineveh in a single day.',
          'In Matthew 12 Jesus explained that one "greater than Jonah" was among them. The life and mission of Jesus Christ proclaims a gospel of greater salvation, and greater hope than Nineveh ever knew.',
        ]),
        image: img('carousel-0c59a44d'),
        alignment: 'left',
      },
      {
        blockType: 'blockquote',
        quote: 'We preach Christ crucified, a stumbling block to the Jews and foolishness to the Gentiles. Yet to those who are called, both Jews and Greeks, Christ is the power of God and the wisdom of God.',
        attribution: '1 Corinthians 1:23-24',
        style: 'centered',
      },
      {
        blockType: 'content',
        heading: 'The gospel fuels everything we do',
        body: richText(
          'At Ev we are very aware of the fact that we are weak. At the same time, we are extraordinarily confident because of God\'s strength. The news of Jesus\' life, death, resurrection and ascension, though appearing foolish to the world around us, is God\'s power for salvation. This gospel message is not just the beginning of the Christian life, but the way God keeps and grows us in the Christian life. It is through this gospel power that we ask God to work in and through us, to see many more people trust in Jesus across this great land and beyond.',
        ),
        alignment: 'center',
      },
      {
        blockType: 'timeline',
        eyebrow: 'The story so far',
        heading: 'From 8 people to a city-wide church',
        description: 'Ev started in January 2012 as 8 people in a lounge room. God has been faithful ever since.',
        theme: 'dark',
        events: [
          { year: '2012', title: 'First gathering', description: '8 people in a lounge room in central Auckland' },
          { year: '2013', title: 'Public launch', description: 'Movie Cinemas at St Lukes Mall, February 2013' },
          { year: '2014', title: 'Unichurch planted', description: 'An evening congregation at the University of Auckland' },
          { year: '2014', title: 'Apprenticeships', description: 'First ministry apprenticeships raising gospel workers' },
          { year: '2015', title: 'Kids ministry', description: 'Kids ministry apprenticeship launches' },
          { year: '2019', title: '2030 Vision', description: '300+ people across the city, vision launched' },
        ],
      },
      {
        blockType: 'blockquote',
        quote: 'God has chosen what is insignificant and despised in the world to bring to nothing what is viewed as something, so that no one may boast in His presence.',
        attribution: '1 Corinthians 1:28-31',
        style: 'centered',
      },
      {
        blockType: 'statsGrid',
        eyebrow: '2030 vision',
        heading: 'Four big things',
        description: 'Given the resources God has given us, the immensity of the need, the urgency of the opportunity and the glory of God, we are prayerfully asking God to do four big things in and through us before the year 2030.',
        items: [
          {
            label: 'Grow',
            stat: '2,030',
            statLabel: 'people across 6 campuses',
            description: "God's picture of the future is a vast picture. A great multitude that no one could count. We care deeply for the lost, and we are asking God to grow His kingdom through us to 2,030 people across 6 Auckland campuses by 2030. Every one of those numbers is a person created by God and for God.",
            scripture: 'After this I looked and there before me was a great multitude that no one could count, from every nation, tribe, people and language, standing before the throne and in front of the Lamb.',
            scriptureReference: 'Revelation 7:9',
          },
          {
            label: 'Plant',
            stat: '8',
            statLabel: 'new churches across NZ',
            description: 'We are asking God to establish 4 more local campuses across Auckland and 4 regional church plants across New Zealand in Dunedin, Hamilton, Tauranga and Palmerston North. Each campus will have live preaching, its own local leadership, and its own local feel. Planting churches comes with big sacrifices, but not planting churches comes with a sacrifice we are not willing to make.',
          },
          {
            label: 'Train',
            stat: '30',
            statLabel: 'gospel workers raised up',
            description: 'Jesus tells us the harvest is plentiful but the workers are few. One of the greatest needs of the local church is equipping the saints for works of service. Through our ministry apprenticeship program, deep theological education, and block courses, we are asking God to raise up 30 workers for word-soaked gospel ministry by 2030.',
            scripture: 'How, then, can they call on Him they have not believed in? And how can they believe without hearing about Him? And how can they hear without a preacher? How beautiful are the feet of those who bring good news.',
            scriptureReference: 'Romans 10:14-15',
          },
          {
            label: 'Build',
            stat: '1',
            statLabel: 'gospel training hub',
            description: 'Imagine a place where our community gathers to hear God\'s word, where people are equipped through conferences and theological training, where children meet their maker at holiday clubs, and where adults and youth feel at ease because their eyes are fixed on their heavenly home. We are not simply building Ev a home, but asking God to create a platform for gospel-centred, training-focused kingdom work for the next 200 years.',
          },
        ],
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('carousel-3c68ddf1') },
          { image: img('carousel-c645786c') },
          { image: img('carousel-168f386e') },
          { image: img('carousel-9a8d8943') },
          { image: img('carousel-db9ac570') },
          { image: img('carousel-79cef650') },
        ],
      },
      {
        blockType: 'manualCardGrid',
        eyebrow: 'How to partner',
        heading: 'Three ways to join in',
        cardStyle: 'info',
        columns: '3',
        cards: [
          {
            title: 'Pray for it',
            description: 'Pray that God would do these four big things in and through us by 2030. We make our plans, but God determines our steps. He is in control and He calls us to depend on Him in prayer.',
          },
          {
            title: 'Stay for it',
            description: 'Decide that as far as humanly possible you will stay for this gospel vision. The spread of the gospel happens through relationships and relationships take time. Commit to staying with this vision until 2030 and beyond.',
          },
          {
            title: 'Pay for it',
            description: 'Everything we have is given to us by God, and is ultimately for His glory. The wisest investment anyone can make, the most secure investment, the investment that will produce the most return, is an investment in the kingdom of God.',
          },
        ],
      },
      {
        blockType: 'cta',
        heading: 'For His glory alone',
        text: 'It is for God\'s glory and His glory alone that we invite you to join with us in this 2030 vision. Jesus deserves to be praised in this city, country and across the globe.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Plan your visit', href: '/visit', variant: 'primary' },
          { label: 'Get in touch', href: '/contact', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'Our Vision | Ev Church Auckland | 2030 Goals',
      metaDescription: "Discover Ev Church's vision for 2030. Four big goals for our Christian community across Auckland, Tamaki Makaurau.",
    },
  })

  /* ─────────────────────── CONTACT PAGE ─────────────────────── */
  await upsertPage('contact', {
    title: 'Contact',
    _status: 'published',
    layout: [
      {
        blockType: 'pageHeader',
        eyebrow: 'Get in touch',
        heading: 'Contact us',
        description: 'Have a question, need prayer, or just want to say hello? Fill out the form below and we will get back to you as soon as we can.',
        theme: 'dark',
      },
      {
        blockType: 'formEmbed',
        formType: 'contact',
        layout: 'full',
      },
      {
        blockType: 'manualCardGrid',
        eyebrow: 'Our locations',
        heading: 'Campus addresses',
        cardStyle: 'info',
        columns: '3',
        cards: [
          {
            title: 'North',
            description: '9-11 Rothwell Avenue, Rosedale, Auckland',
            details: [
              { label: 'Service', value: 'Sunday 10:15 am' },
              { label: 'Email', value: 'north@ev.church' },
            ],
          },
          {
            title: 'Central',
            description: '80 Olsen Avenue, Hillsborough, Auckland',
            details: [
              { label: 'Service', value: 'Sunday 10:15 am' },
              { label: 'Email', value: 'central@ev.church' },
            ],
          },
          {
            title: 'Unichurch',
            description: 'University of Auckland, 24 Princes Street, Auckland 1010',
            details: [
              { label: 'Service', value: 'Sunday 5:15 pm' },
              { label: 'Email', value: 'unichurch@ev.church' },
            ],
          },
        ],
      },
    ],
    seo: {
      metaTitle: 'Contact Ev Church Auckland | Get in Touch',
      metaDescription: 'Get in touch with Ev Church Auckland. Find our campus addresses, service times, and contact details.',
    },
  })

  /* ─────────────────────── KIDS PAGE ─────────────────────── */
  await upsertPage('kids', {
    title: 'Ev Kids',
    _status: 'published',
    template: 'ministry',
    layout: [
      {
        blockType: 'hero',
        image: img('ev-kids-banner'),
        eyebrow: 'Ages 0 to 12',
        heading: 'Ev Kids',
        highlightedText: 'Kids',
        subtitle: 'A safe, fun, and engaging place where your children can learn, play, and grow. Ev Kids runs every Sunday during all services.',
        overlayStyle: 'cinematic',
        minHeight: '70vh',
      },
      {
        blockType: 'content',
        heading: 'Where kids discover faith, friendship, and fun',
        body: richText(
          'Ev Kids is our dedicated children\'s ministry for ages 1 to 12, running at North and Central campuses. Every Sunday, while you enjoy the service, your children are cared for by trained, police-vetted volunteers in age-appropriate programs filled with creativity, music, and Bible-based teaching.',
        ),
        alignment: 'center',
      },
      {
        blockType: 'featureGrid',
        eyebrow: 'Our programs',
        heading: 'Three programs, one mission',
        layout: 'threeColumn',
        style: 'iconTop',
        accentColor: '#0096C3',
        items: [
          {
            icon: 'heart',
            title: 'Creche (0 to 2 years)',
            description: 'A gentle, nurturing space for babies and toddlers. Our trained volunteers provide a safe and caring environment so parents can enjoy the service with peace of mind.',
          },
          {
            icon: 'star',
            title: 'Explorers (3 to 5 years)',
            description: 'Creative, play-based learning that introduces preschoolers to Bible stories through songs, crafts, and interactive activities. Every session is designed to be fun and memorable.',
          },
          {
            icon: 'globe',
            title: 'Adventurers (6 to 12 years)',
            description: 'High-energy, interactive sessions with games, worship, small groups, and Bible teaching. Adventurers is where kids build friendships and grow in their faith.',
          },
        ],
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('carousel-79cef650') },
          { image: img('carousel-3c68ddf1') },
          { image: img('carousel-168f386e') },
          { image: img('carousel-aea4638f') },
        ],
      },
      {
        blockType: 'accordion',
        heading: 'Frequently asked questions',
        items: [
          {
            question: 'Is Ev Kids available at every service?',
            answer: 'Yes. Ev Kids runs during every Sunday service at North and Central campuses.',
          },
          {
            question: 'How do I check in my child?',
            answer: 'When you arrive, our welcome team will direct you to the kids check-in area. You will receive a tag that matches your child for a secure pick-up after the service.',
          },
          {
            question: 'What if my child has special needs or allergies?',
            answer: 'We want every child to have a great experience. Please let our team know at check-in about any special needs, allergies, or requirements, and we will do our best to accommodate them.',
          },
          {
            question: 'Can I stay with my child?',
            answer: 'Absolutely. Parents are welcome to stay with their children, especially in the Creche. We want you to feel comfortable and confident in the care your child receives.',
          },
          {
            question: 'Are your volunteers police vetted?',
            answer: 'Yes. All Ev Kids volunteers are police vetted and trained in child safety. The wellbeing of your children is our highest priority.',
          },
        ],
      },
      {
        blockType: 'cta',
        heading: 'Your kids will love it',
        text: 'Bring your family along this Sunday. Our team is ready to welcome your children into a space made just for them.',
        colorPreset: 'primary-red',
        accentColor: '#0096C3',
        buttons: [
          { label: 'Plan your visit', href: '/visit', variant: 'primary' },
          { label: 'Get in touch', href: '/contact', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'Kids Church Program Auckland | Ev Kids | Ages 0-12',
      metaDescription: 'Ev Kids is a safe, fun program for children aged 0-12, running every Sunday at Ev Church Auckland. Creche, Explorers, and Adventurers.',
    },
  })

  /* ─────────────────────── YOUTH PAGE ─────────────────────── */
  await upsertPage('youth', {
    title: 'Ev Youth',
    _status: 'published',
    template: 'ministry',
    layout: [
      {
        blockType: 'hero',
        image: img('ev-youth-banner'),
        eyebrow: 'Years 7 to 13',
        heading: 'Ev Youth',
        highlightedText: 'Youth',
        subtitle: 'A place for teenagers to connect, grow, and find where they belong. Real community. Real faith. Real fun.',
        overlayStyle: 'cinematic',
        minHeight: '70vh',
      },
      {
        blockType: 'content',
        heading: 'Where teenagers find their people',
        body: richText(
          'Ev Youth exists to help young people navigate life with faith, community, and purpose. Every week, teens from across Auckland come together for worship, fun, and authentic relationships with peers and leaders who genuinely care.',
        ),
        alignment: 'center',
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('youthleaders-all') },
          { image: img('youthleaders-fun') },
          { image: img('youthleaders-junior1') },
          { image: img('youthleaders-senior') },
        ],
      },
      {
        blockType: 'manualCardGrid',
        eyebrow: 'Programs',
        heading: 'Two programs, one heart',
        cardStyle: 'info',
        columns: '2',
        cards: [
          {
            title: 'Junior Youth',
            subtitle: 'Friday nights',
            description: 'Junior Youth is where young teens find their people. Each week is packed with games, food, small groups, and real conversations about faith and life. It is a place to belong, to be known, and to have a blast.',
            details: [
              { label: 'Ages', value: 'Years 7 to 9' },
              { label: 'Games and activities', value: 'Yes' },
              { label: 'Small group discussions', value: 'Yes' },
              { label: 'Weekend camps and events', value: 'Yes' },
            ],
          },
          {
            title: 'Senior Youth',
            subtitle: 'Friday nights',
            description: 'Senior Youth is a space for older teens to go deeper. With worship, teaching, honest conversations, and genuine community, it is designed to help young people navigate the real challenges of life with faith and confidence.',
            details: [
              { label: 'Ages', value: 'Years 10 to 13' },
              { label: 'Worship and teaching', value: 'Yes' },
              { label: 'Leadership development', value: 'Yes' },
              { label: 'Retreats and conferences', value: 'Yes' },
            ],
          },
        ],
      },
      {
        blockType: 'cta',
        heading: 'Your teen is welcome here',
        text: 'Whether your teenager is looking for community, exploring faith, or just wants somewhere to belong, Ev Youth is the place.',
        colorPreset: 'primary-red',
        accentColor: '#870394',
        buttons: [
          { label: 'Get in touch', href: '/contact', variant: 'primary' },
          { label: 'Plan a visit', href: '/visit', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'Youth Group Auckland | Ev Youth | Friday Nights',
      metaDescription: "Ev Youth is for teenagers on Auckland's North Shore. Friday nights filled with community, faith, and fun. Junior and Senior Youth.",
    },
  })

  /* ─────────────────────── NEWISH CONNECT PAGE ─────────────────────── */
  await upsertPage('newish', {
    title: 'Newish Connect',
    _status: 'published',
    layout: [
      {
        blockType: 'hero',
        image: img('newish-connect-banner'),
        eyebrow: 'New to Ev?',
        heading: 'Newish Connect',
        highlightedText: 'Connect',
        subtitle: 'Whether you have been coming for a few weeks or a few months, Newish Connect is the perfect way to get to know Ev Church and find where you belong.',
        overlayStyle: 'cinematic',
        minHeight: '70vh',
      },
      {
        blockType: 'content',
        heading: 'Your next step at Ev',
        body: richText([
          'Newish Connect is a casual, fun gathering designed for anyone who is new or relatively new to Ev Church. It is your chance to meet the pastors, learn about the church\'s vision, and connect with other people who are finding their place.',
          'There is no commitment and no pressure. Just good conversation, good food, and a chance to take your next step. Whether that is joining a connect group, volunteering on a team, or simply getting to know more people, Newish Connect will help you find your way.',
        ]),
        alignment: 'left',
      },
      {
        blockType: 'featureGrid',
        eyebrow: 'What happens',
        heading: 'A simple, welcoming experience',
        layout: 'fourColumn',
        style: 'iconTop',
        items: [
          {
            icon: 'coffee',
            title: 'Grab a coffee',
            description: 'Arrive and settle in with a great coffee and some food. It is relaxed, warm, and welcoming.',
          },
          {
            icon: 'book',
            title: 'Hear the story',
            description: 'Our pastors share the heart and vision of Ev Church. Where we have come from, where we are going, and why it matters.',
          },
          {
            icon: 'users',
            title: 'Meet your people',
            description: 'Connect with other newcomers and leaders in a casual setting. Ask questions, share your story, and start building friendships.',
          },
          {
            icon: 'heart',
            title: 'Find your place',
            description: 'Discover the many ways you can get involved. From serving teams to connect groups, there is a place for everyone.',
          },
        ],
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('carousel-3c68ddf1') },
          { image: img('carousel-89a3395d') },
          { image: img('carousel-8aae1142') },
          { image: img('carousel-c842f7b4') },
        ],
      },
      {
        blockType: 'formEmbed',
        eyebrow: 'Join us',
        heading: 'Sign up for Newish Connect',
        description: 'The next Newish Connect gathering will be announced soon. Register below and we will save you a spot.',
        formType: 'signup',
        formTitle: 'Newish Connect',
        layout: 'centered',
      },
      {
        blockType: 'cta',
        heading: 'We would love to meet you',
        text: 'Newish Connect is the easiest way to take your next step at Ev. Come along and see what it is all about.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Plan your visit', href: '/visit', variant: 'primary' },
          { label: 'Get in touch', href: '/contact', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'New to Ev Church Auckland? | Newish Connect',
      metaDescription: 'Just started coming to Ev Church? Newish Connect is the perfect way to meet people and find where you belong.',
    },
  })

  /* ─────────────────────── EXPLAINING CHRISTIANITY PAGE ─────────────────────── */
  await upsertPage('explaining-christianity', {
    title: 'Explaining Christianity',
    _status: 'published',
    layout: [
      {
        blockType: 'hero',
        image: img('ec-banner'),
        eyebrow: 'Explore the faith',
        heading: 'Explaining Christianity',
        highlightedText: 'Christianity',
        subtitle: 'A relaxed, no-pressure course for anyone curious about the Christian faith. Ask your questions. Hear real stories. Decide for yourself.',
        overlayStyle: 'cinematic',
        minHeight: '70vh',
      },
      {
        blockType: 'content',
        heading: 'What is Explaining Christianity?',
        body: richText([
          'Explaining Christianity is a short course designed for people who want to explore the Christian faith in an honest, open environment. Whether you have never been to church, you grew up going but drifted away, or you are simply curious, this course is for you.',
          'Over several weeks, we look at the big questions of life and what the Bible has to say about them. Each session includes a short talk, a chance to discuss in small groups, and plenty of time for your questions.',
          'There is no pressure to believe anything, sign anything, or come back the following week. This is simply a space for honest exploration.',
        ]),
        alignment: 'left',
      },
      {
        blockType: 'featureGrid',
        eyebrow: 'What to expect',
        heading: 'No pressure, just good conversation',
        layout: 'fourColumn',
        style: 'iconTop',
        items: [
          {
            icon: 'smile',
            title: 'Relaxed atmosphere',
            description: 'No awkward moments, no pressure. Just honest conversations over good food and coffee.',
          },
          {
            icon: 'chat',
            title: 'Real questions welcome',
            description: 'There are no silly questions. This is a space to ask anything you have ever wondered about faith.',
          },
          {
            icon: 'clock',
            title: 'Short and flexible',
            description: 'The course runs over several weeks with short sessions. No commitment to keep coming if it is not for you.',
          },
          {
            icon: 'users',
            title: 'Bring a friend',
            description: 'Everything is better with a mate. You are welcome to bring someone along for the journey.',
          },
        ],
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('carousel-c645786c') },
          { image: img('carousel-9a8d8943') },
          { image: img('carousel-c645786c') },
          { image: img('carousel-db9ac570') },
        ],
      },
      {
        blockType: 'formEmbed',
        eyebrow: 'Register your interest',
        heading: 'Sign up for the next course',
        description: 'The next Explaining Christianity course will be announced soon. Register your interest and we will let you know when dates are confirmed.',
        formType: 'signup',
        formTitle: 'Explaining Christianity',
        layout: 'centered',
      },
      {
        blockType: 'cta',
        heading: 'Curious? That is a great start.',
        text: 'You do not need to have all the answers. You just need to be willing to ask the questions. We would love to explore them with you.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Ask us anything', href: '/contact', variant: 'primary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'Christianity Course Auckland | Explore Faith at Ev Church',
      metaDescription: 'Curious about the Christian faith? Join Explaining Christianity at Ev Church Auckland. Relaxed, no-pressure, all questions welcome.',
    },
  })

  /* ─────────────────────── EASTER PAGE ─────────────────────── */
  await upsertPage('easter', {
    title: 'Easter',
    _status: 'published',
    template: 'seasonal-event',
    layout: [
      {
        blockType: 'hero',
        image: img('carousel-146c7f7e'),
        eyebrow: 'Join us this Easter',
        heading: 'Easter at Ev',
        highlightedText: 'Ev',
        subtitle: 'Easter is the heart of our faith. Join us for special services filled with live music, an inspiring message, and a warm community ready to welcome you.',
        overlayStyle: 'cinematic',
        minHeight: '70vh',
      },
      {
        blockType: 'content',
        heading: 'A story of hope, love, and new beginnings',
        body: richText([
          'Easter is more than a long weekend. It is the story that changed everything. Over 2,000 years ago, Jesus gave his life so that we could have a fresh start, a restored relationship with God, and a hope that reaches beyond this life.',
          'Good Friday marks the day Jesus was crucified. It is a day of reflection and gratitude. Easter Sunday celebrates the resurrection, the moment death was defeated and new life was made possible for everyone.',
          'Whether this is a story you know well or one you are hearing for the first time, we would love for you to experience Easter with us.',
        ]),
        image: img('carousel-70ac2785'),
        alignment: 'left',
      },
      {
        blockType: 'blockquote',
        quote: 'I am the resurrection and the life. The one who believes in me will live, even though they die.',
        attribution: 'John 11:25',
        style: 'centered',
      },
      {
        blockType: 'manualCardGrid',
        eyebrow: 'Service times',
        heading: 'Easter services across Auckland',
        description: 'Join us at any of our three campuses for a special Easter experience.',
        cardStyle: 'info',
        columns: '3',
        cards: [
          {
            title: 'North',
            description: '9-11 Rothwell Avenue, Rosedale, Auckland',
            details: [
              { label: 'Good Friday', value: '10:00 am' },
              { label: 'Easter Sunday', value: '10:15 am' },
            ],
          },
          {
            title: 'Central',
            description: '80 Olsen Avenue, Hillsborough, Auckland',
            details: [
              { label: 'Good Friday', value: '10:00 am' },
              { label: 'Easter Sunday', value: '10:15 am' },
            ],
          },
          {
            title: 'Unichurch',
            description: 'University of Auckland, 24 Princes Street, Auckland 1010',
            details: [
              { label: 'Easter Sunday', value: '5:15 pm' },
            ],
          },
        ],
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('carousel-3c68ddf1') },
          { image: img('carousel-9a8d8943') },
          { image: img('carousel-aea4638f') },
          { image: img('carousel-c645786c') },
        ],
      },
      {
        blockType: 'accordion',
        heading: 'Frequently asked questions',
        items: [
          {
            question: 'Do I need to register for Easter services?',
            answer: 'No registration is needed. Just show up and we will have a seat for you. Arrive a little early to grab a coffee and settle in.',
          },
          {
            question: 'Is there a kids program on Easter?',
            answer: 'Yes. Ev Kids runs during all Easter services for children aged 0 to 12. It is a special Easter edition with fun activities and crafts.',
          },
          {
            question: 'What should I wear?',
            answer: 'Whatever you are comfortable in. There is no dress code at Ev Church. Come as you are.',
          },
          {
            question: 'How long are the services?',
            answer: 'Easter services run approximately 75 to 90 minutes. They include live worship music, a message, and time for reflection.',
          },
          {
            question: 'Can I invite friends and family?',
            answer: 'Absolutely. Easter is one of the best times to invite someone to church. Everyone is welcome.',
          },
        ],
      },
      {
        blockType: 'cta',
        heading: 'We would love to see you this Easter',
        text: 'Easter is one of the best times to visit Ev Church. Bring your family, bring a friend, and experience the hope of Easter with us.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Plan your visit', href: '/visit', variant: 'primary' },
          { label: 'Get in touch', href: '/contact', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'Easter Services Auckland 2026 | Ev Church',
      metaDescription: 'Join Ev Church for Easter 2026. Special services at North, Central, and Unichurch campuses across Auckland.',
    },
  })

  /* ─────────────────────── CONNECT GROUPS PAGE ─────────────────────── */
  await upsertPage('connect-groups', {
    title: 'Connect Groups',
    _status: 'published',
    layout: [
      {
        blockType: 'hero',
        image: img('connect-groups-banner'),
        eyebrow: 'Find your people',
        heading: 'Connect Groups',
        highlightedText: 'Groups',
        subtitle: 'Church is more than a Sunday service. Connect Groups are where real friendships form, faith deepens, and life is shared.',
        overlayStyle: 'cinematic',
        minHeight: '70vh',
      },
      {
        blockType: 'content',
        heading: 'What are Connect Groups?',
        body: richText(
          'Connect Groups are small gatherings of people who meet regularly in homes across Auckland. They are a place to build genuine friendships, discuss faith, support one another, and have fun. Whether you are new to church or have been coming for years, a Connect Group is the best way to find your people.',
        ),
        alignment: 'center',
      },
      {
        blockType: 'manualCardGrid',
        eyebrow: 'Find a group',
        heading: 'Groups for every season of life',
        cardStyle: 'info',
        columns: '3',
        cards: [
          {
            title: 'Young Adults',
            subtitle: 'Wednesday evenings',
            description: 'For people in their 20s and early 30s navigating work, relationships, and faith.',
            details: [{ label: 'Location', value: 'Various locations' }],
          },
          {
            title: 'Couples',
            subtitle: 'Thursday evenings',
            description: 'For couples at any stage. Build friendships with others doing life together.',
            details: [{ label: 'Location', value: 'Various homes' }],
          },
          {
            title: 'Women',
            subtitle: 'Tuesday mornings',
            description: 'A supportive space for women to connect, share, and grow in faith.',
            details: [{ label: 'Location', value: 'Various locations' }],
          },
          {
            title: 'Men',
            subtitle: 'Wednesday evenings',
            description: 'Authentic conversations and genuine friendships for men of all ages.',
            details: [{ label: 'Location', value: 'Various locations' }],
          },
          {
            title: 'Families',
            subtitle: 'Fortnightly Sundays',
            description: 'For families with kids. Faith, food, and fun for the whole household.',
            details: [{ label: 'Location', value: 'Various homes' }],
          },
          {
            title: 'Mixed',
            subtitle: 'Various evenings',
            description: 'Open to anyone. A diverse group of people doing life and faith together.',
            details: [{ label: 'Location', value: 'Various homes' }],
          },
        ],
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('carousel-0c59a44d') },
          { image: img('carousel-5940ca71') },
          { image: img('carousel-168f386e') },
          { image: img('carousel-9a8d8943') },
        ],
      },
      {
        blockType: 'cta',
        heading: 'Ready to find your group?',
        text: 'We will help you find a Connect Group that fits your life, your schedule, and your season. Get in touch and we will connect you with the right people.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Join a group', href: '/contact', variant: 'primary' },
          { label: 'Plan a visit', href: '/visit', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'Connect Groups Auckland | Small Groups at Ev Church',
      metaDescription: 'Join a Connect Group at Ev Church Auckland. Young adults, couples, women, men, and families meeting weekly across the city.',
    },
  })

  /* ─────────────────────── NEXT STEPS PAGE (NEW) ─────────────────────── */
  await upsertPage('next-steps', {
    title: 'Next Steps',
    _status: 'published',
    layout: [
      {
        blockType: 'pageHeader',
        eyebrow: 'Next steps',
        heading: 'Find your place',
        description: 'Whether you are exploring faith, looking to connect with others, or want to get involved, there is a next step for you. Discover courses, groups, and programs designed to help you grow.',
        theme: 'dark',
      },
      {
        blockType: 'manualCardGrid',
        eyebrow: 'Explore',
        heading: 'Pathways for every season',
        cardStyle: 'alternatingRows',
        columns: '2',
        cards: [
          {
            image: img('ec-banner'),
            title: 'Explaining Christianity',
            description: 'A relaxed, no-pressure course exploring the basics of the Christian faith. Ask your questions, hear real stories, and decide for yourself. Perfect for anyone curious about what Christians believe and why.',
            href: '/explaining-christianity',
            linkLabel: 'Learn more about EC',
          },
          {
            image: img('newish-connect-banner'),
            title: 'Newish Connect',
            description: 'New to Ev Church? Newish Connect is a casual gathering where you can meet the pastors, hear the vision, and connect with others who are finding their place. Great food and zero pressure.',
            href: '/newish',
            linkLabel: 'Learn more about Newish',
          },
          {
            image: img('connect-groups-banner'),
            title: 'Connect Groups',
            description: 'Small groups that meet in homes across Auckland during the week. A place to build real friendships, discuss faith, and support one another through every season of life.',
            href: '/connect-groups',
            linkLabel: 'Find a group',
          },
          {
            image: img('ev-kids-banner'),
            title: 'Ev Kids',
            description: 'A safe, fun, and engaging environment for children aged 0 to 12 every Sunday. Three age-appropriate programs filled with creativity, music, and Bible-based teaching.',
            href: '/kids',
            linkLabel: 'Learn more about Kids',
          },
          {
            image: img('ev-youth-banner'),
            title: 'Ev Youth',
            description: 'A vibrant community for teenagers in Years 7 to 13. Junior Youth and Senior Youth meet weekly for worship, fun, small groups, and genuine friendships.',
            href: '/youth',
            linkLabel: 'Learn more about Youth',
          },
        ],
      },
      {
        blockType: 'cta',
        heading: 'Not sure where to start?',
        text: 'That is completely fine. Get in touch with our team and we will help you figure out the best next step for where you are right now.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Get in touch', href: '/contact', variant: 'primary' },
          { label: 'Plan a visit', href: '/visit', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'Next Steps at Ev Church Auckland | Get Connected',
      metaDescription: 'Ready to take the next step? Explore courses, groups, and programs at Ev Church Auckland.',
    },
  })

  /* ─────────────────────── WHAT WE BELIEVE PAGE ─────────────────────── */
  await upsertPage('what-we-believe', {
    title: 'What We Believe',
    _status: 'published',
    layout: [
      {
        blockType: 'pageHeader',
        eyebrow: 'Our beliefs',
        heading: 'What we believe',
        description: 'Ev Church is an evangelical church that is independent in governance but united with Christians around the world and throughout history in upholding the gospel of Jesus Christ. We hold the Bible to be the supreme authority in all matters of faith and conduct and weigh all our teaching against its standard.',
        theme: 'dark',
      },
      {
        blockType: 'content',
        heading: 'Our foundational convictions',
        body: richText(
          "We believe the teachings outlined in the historic church creeds (known commonly as The Apostles' Creed, The Nicene Creed and The Athanasian Creed) are faithful expressions of the teaching of the Christian Scriptures. We hold to the Reformation teaching that God's rescue comes by grace alone, through faith alone, in the Person and work of Christ alone as revealed in the Scripture alone, to the glory of God alone.",
        ),
        alignment: 'center',
      },
      {
        blockType: 'accordion',
        heading: 'What we believe',
        items: [
          {
            question: 'About God',
            answer: "There is one unique and eternal God, who exists in an everlasting loving relationship of Father, Son and Spirit \u2013 one God in three persons. God is sovereign in all things: including creation, revelation, redemption, judgement and the establishing of His kingdom. As sovereign loving creator and redeemer, He is worthy of all glory, honour and praise.",
          },
          {
            question: 'About Humanity',
            answer: "Men and women together are created in the image of God and, therefore, enjoy a unique dignity in creation and a unique relationship with God. Men and women together have dominion over the created order. Tragically, human nature is universally sinful since the Fall and all are guilty before God. This leaves us under the wrath and condemnation of God. We are unable, without the prior regenerative work of God's Spirit, to turn ourselves to God.",
          },
          {
            question: 'About the Bible',
            answer: "There is no other way to know God except that He reveals Himself to us. The Bible is God's revelation to us. The words of the Bible are divinely inspired and infallible, as originally given, and have supreme authority in all matters of faith, conduct and experience. The Bible is sufficient for knowing God. It is not only central to the well-being of the church but is able to thoroughly equip the Christian community for life and godliness.",
          },
          {
            question: 'About Jesus Christ',
            answer: "Jesus Christ was conceived by the Holy Spirit and born of the virgin Mary. He is both fully God and truly human. He entered fully into human experience. He endured temptation and He suffered and died. He was perfectly obedient to God His father. Jesus took on Himself the consequences of human sin. He died and was buried. On the third day He rose from the dead bodily and is now exalted as ruler over all. He will come again in glory to judge the living and the dead.",
          },
          {
            question: 'About Salvation',
            answer: "There is only one name under heaven by which we can be brought into relationship with God: the name \u2018Jesus Christ\u2019. It is only through the sacrificial death of Jesus Christ, as our representative and substitute, that the guilt, penalty and power of sin can be removed. In that death, God demonstrates His love to us most perfectly and establishes His victory over Satan and all His foes. The work of the Holy Spirit is necessary to make the death of Jesus effective in an individual's life. The Spirit enables the sinner to repent and put their faith in Jesus Christ, so that salvation is entirely of God's grace, through faith alone, and not of human merit or works.",
          },
          {
            question: 'About the Holy Spirit',
            answer: "The Holy Spirit is co-equal with the Father and the Son, and indwells all true believers. His role is to bring glory to Jesus Christ, thus making Jesus Christ central in all things. The Spirit works to illuminate believers' minds to grasp the truth of the Bible, producing in them His fruit, granting them His gifts and empowering them for service. He grants His gifts for the purpose of service, not self-indulgence.",
          },
          {
            question: 'About the Church',
            answer: "The visible church is the gathering of believers around Christ in His word. It is a community of people intended by God to bear witness to Him and actively seek the extension of His rule. Within its community, both men and women are to seek proper expression of their gifts as they work to build the church in love.",
          },
        ],
      },
      {
        blockType: 'cta',
        heading: 'Want to explore further?',
        text: 'If you are curious about the Christian faith or have questions about what we believe, we would love to chat. Explaining Christianity is a relaxed course where you can ask anything in a no-pressure environment.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'The Good News', href: '/good-news', variant: 'primary' },
          { label: 'Explore Christianity', href: '/explaining-christianity', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'What We Believe | Ev Church Auckland | Core Beliefs',
      metaDescription: 'Explore the core beliefs of Ev Church Auckland. What we believe about God, Jesus, the Bible, salvation, and the church. An evangelical Christian community in Tamaki Makaurau.',
    },
  })

  /* ─────────────────────── FAQ PAGE ─────────────────────── */
  await upsertPage('faq', {
    title: 'FAQ',
    _status: 'published',
    layout: [
      {
        blockType: 'pageHeader',
        eyebrow: 'Common questions',
        heading: 'Frequently asked questions',
        description: 'Everything you need to know about visiting Ev Church in Auckland. Can not find what you are looking for? Get in touch.',
        theme: 'dark',
      },
      {
        blockType: 'accordion',
        heading: 'About Ev Church',
        allowMultiple: true,
        items: [
          {
            question: 'What time are services at Ev Church?',
            answer: 'We have Sunday services at three campuses across Auckland. Ev North (Rosedale) and Ev Central (Hillsborough) both meet at 10:15 am. Unichurch meets at 5:15 pm at the University of Auckland. Services run for approximately 75 minutes.',
          },
          {
            question: 'Where is Ev Church located?',
            answer: 'Ev Church has three campuses across Auckland, Tamaki Makaurau. Ev North is at 9-11 Rothwell Avenue, Rosedale. Ev Central is at 80 Olsen Avenue, Hillsborough. Unichurch meets at the University of Auckland, 24 Princes Street, Auckland CBD.',
          },
          {
            question: 'Is Ev Church family-friendly? What about kids?',
            answer: 'Absolutely. Ev Kids runs every Sunday during our North and Central services for children aged 0 to 12. We have three age groups: Creche (0-2 years), Explorers (3-5 years), and Adventurers (6-12 years). All our volunteers are police vetted and we maintain strict sign-in and sign-out procedures.',
          },
          {
            question: 'What denomination is Ev Church?',
            answer: 'Ev Church is an evangelical Christian church. We are independent in governance but united with Christians around the world in upholding the gospel of Jesus Christ. We hold the Bible to be the supreme authority in all matters of faith and conduct.',
          },
          {
            question: 'What should I wear to church?',
            answer: 'Come as you are. There is no dress code at Ev Church. You will see everything from jeans and t-shirts to smart casual. We want you to feel comfortable and welcome, whatever you wear.',
          },
          {
            question: 'How can I get involved or volunteer?',
            answer: 'There are many ways to get involved at Ev Church. You can join a Connect Group to build friendships and grow in faith, serve on a Sunday team (welcome, kids, music, tech), or get involved in outreach and community projects. The best first step is to come along to Newish Connect.',
          },
          {
            question: 'Do you have youth programs?',
            answer: 'Yes. Ev Youth runs on Friday nights for teenagers. We have Junior Youth and Senior Youth groups, both meeting on the North Shore. It is a place for teenagers to connect, grow, and find where they belong.',
          },
          {
            question: 'What are Connect Groups?',
            answer: 'Connect Groups are small groups of people who meet regularly throughout the week to share life, study the Bible, and support one another. We have groups for young adults, couples, women, men, and families across Auckland.',
          },
          {
            question: 'Is there parking available?',
            answer: 'Yes, parking is available on site at both our North (Rosedale) and Central (Hillsborough) campuses. Unichurch meets in central Auckland where street parking and nearby parking buildings are available.',
          },
          {
            question: 'How do I find out more about the Christian faith?',
            answer: 'We run a course called Explaining Christianity, which is a relaxed, no-pressure environment to ask questions and explore the basics of the Christian faith. It is open to anyone, whether you are curious, sceptical, or just want to learn. You can also come along to a Sunday service or chat with one of our pastors.',
          },
        ],
      },
      {
        blockType: 'cta',
        heading: 'Still have questions?',
        text: 'We would love to hear from you. Reach out to our team and we will get back to you as soon as we can.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Contact us', href: '/contact', variant: 'primary' },
          { label: 'Plan a visit', href: '/visit', variant: 'secondary' },
        ],
      },
    ],
    seo: {
      metaTitle: 'FAQ | Ev Church Auckland | Frequently Asked Questions',
      metaDescription: 'Answers to common questions about Ev Church Auckland. Service times, locations, kids programs, parking, and how to get involved.',
    },
  })

  /* ─────────────────────── GOOD NEWS PAGE ─────────────────────── */
  await upsertPage('good-news', {
    title: 'The Good News',
    _status: 'published',
    layout: [
      {
        blockType: 'hero',
        image: img('gn-hero'),
        eyebrow: 'The heart of what we believe',
        heading: 'The Good News',
        highlightedText: 'Good News',
        subtitle: 'There is a message at the centre of Christianity that has changed millions of lives. It is not a set of rules. It is not a list of things to believe. It is an invitation.',
        overlayStyle: 'cinematic',
        minHeight: '70vh',
      },
      {
        blockType: 'content',
        heading: 'You were made for more',
        body: richText([
          'Have you ever had the feeling that life should be more than what you see around you? That there is something deeper going on beneath the surface of everyday life?',
          'The Bible says you are not an accident. You were created on purpose, by a God who knows you and loves you more than you can imagine. You were made to be in relationship with Him, to know Him and be known by Him. Every person carries an incredible dignity and value, not because of what they achieve, but simply because of who made them.',
          'This is where the story begins. Not with religion or rules, but with a God who made you because He wanted to.',
        ]),
        image: img('gn-stars'),
        alignment: 'left',
      },
      {
        blockType: 'cta',
        heading: 'Something is broken',
        text: 'But if we are honest, something is not right. We feel it in our relationships, in the world around us, and deep inside ourselves. We hurt people we love. We chase things that leave us empty. We know what is right but struggle to do it. The Bible calls this sin. It is not just bad behaviour. It is the deep fracture between us and the God who made us. Every one of us has turned away from God in our own way, choosing to live life on our own terms. And that separation has consequences we cannot fix on our own.',
        colorPreset: 'dark',
        backgroundImage: img('gn-alone-rain'),
      },
      {
        blockType: 'photoStrip',
        layout: 'horizontalScroll',
        images: [
          { image: img('gn-coffee') },
          { image: img('gn-care') },
          { image: img('gn-studying') },
          { image: img('gn-family') },
          { image: img('gn-ocean') },
          { image: img('gn-worship') },
        ],
      },
      {
        blockType: 'content',
        heading: 'God did not give up on us',
        body: richText([
          'Here is the heart of the good news: God saw the mess we were in, and He did not walk away. Instead, He came to us.',
          'Two thousand years ago, God entered our world as a real person. Jesus Christ, the Son of God, was born, lived among ordinary people, and showed us what God is truly like. He healed the sick, welcomed the outcast, and loved people that everyone else had given up on.',
          'But Jesus did not just come to teach or to set an example. He came to do something only He could do. He took the weight of everything that separates us from God, all our sin and brokenness, and carried it to the cross. He died in our place, paying a price we could never pay ourselves. It was the ultimate act of love.',
        ]),
        image: img('gn-compassion'),
        alignment: 'right',
      },
      {
        blockType: 'blockquote',
        quote: 'God demonstrates his own love for us in this: while we were still sinners, Christ died for us.',
        attribution: 'Romans 5:8',
        style: 'centered',
      },
      {
        blockType: 'cta',
        heading: 'Everything changed',
        text: 'Three days after Jesus died, something happened that changed the course of history. He rose from the dead. The resurrection is not a metaphor. It is the moment when death and brokenness lost their power. Because Jesus is alive, there is real hope. Not just hope that things might get a bit better, but hope that everything sad and broken will one day be made right. His resurrection is proof that God keeps His promises, and that the life He offers is real and lasting.',
        colorPreset: 'dark',
        backgroundImage: img('gn-light-clouds'),
      },
      {
        blockType: 'content',
        heading: 'An open invitation',
        body: richText([
          'So where does that leave you? Right here, with an invitation.',
          'God is not asking you to clean yourself up first or to have all the answers. He is inviting you to come as you are and to receive what He has already done for you. The Bible says that anyone who turns to God and puts their trust in Jesus will be forgiven, welcomed, and given a completely new start.',
          'This is the good news. It is not something you have to earn. It is a gift. And it is for you, right now, wherever you are.',
        ]),
        alignment: 'center',
      },
      {
        blockType: 'video',
        url: 'https://vimeo.com/133616240',
      },
      {
        blockType: 'cta',
        heading: 'Take a next step',
        text: 'Wherever you are on your journey, we would love to walk with you. There is no pressure, just an open door.',
        colorPreset: 'primary-red',
        buttons: [
          { label: 'Visit us this Sunday', href: '/visit', variant: 'primary' },
          { label: 'Explore Christianity', href: '/explaining-christianity', variant: 'secondary' },
        ],
        supportingText: 'Have questions? We would love to chat. Reach out to our team at any time.',
      },
    ],
    seo: {
      metaTitle: 'What is the Good News? | Ev Church Auckland',
      metaDescription: 'Discover the message at the heart of Christianity. A simple, honest look at who God is, what went wrong, and the hope that changes everything.',
    },
  })

  console.log('\nSeed complete! All pages created successfully.')
}

seed()
  .then(() => {
    console.log('Done.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
