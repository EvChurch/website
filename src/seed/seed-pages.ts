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
  { key: 'carousel-0c59a44d', filePath: 'homepage/carousel-0c59a44d.jpg', alt: 'Ev Church community gathering' },
  { key: 'carousel-146c7f7e', filePath: 'homepage/carousel-146c7f7e.jpg', alt: 'Ev Church community celebration' },
  { key: 'carousel-168f386e', filePath: 'homepage/carousel-168f386e.jpg', alt: 'Kids enjoying activities at Ev Church' },
  { key: 'carousel-168f386e', filePath: 'homepage/carousel-168f386e.jpg', alt: 'Community life at Ev Church' },
  { key: 'carousel-3c68ddf1', filePath: 'homepage/carousel-3c68ddf1.jpg', alt: 'Families at Ev Church' },
  { key: 'carousel-3c68ddf1', filePath: 'homepage/carousel-3c68ddf1.jpg', alt: 'People connecting at Ev Church' },
  { key: 'carousel-5940ca71', filePath: 'homepage/carousel-5940ca71.jpg', alt: 'Friends laughing in community' },
  { key: 'carousel-c645786c', filePath: 'homepage/carousel-c645786c.jpg', alt: 'Worship at Ev Church' },
  { key: 'carousel-70ac2785', filePath: 'homepage/carousel-70ac2785.jpg', alt: 'Ev Church North campus' },
  { key: 'carousel-79cef650', filePath: 'homepage/carousel-79cef650.jpg', alt: 'Children at Ev Church' },
  { key: 'carousel-89a3395d', filePath: 'homepage/carousel-89a3395d.jpg', alt: 'Community at Ev Church' },
  { key: 'carousel-8aae1142', filePath: 'homepage/carousel-8aae1142.jpg', alt: 'People laughing together at Ev Church' },
  { key: 'carousel-9a8d8943', filePath: 'homepage/carousel-9a8d8943.jpg', alt: 'Community gathering at Ev Church' },
  { key: 'carousel-aea4638f', filePath: 'homepage/carousel-aea4638f.jpg', alt: 'Community gathering with children' },
  { key: 'carousel-c645786c', filePath: 'homepage/carousel-c645786c.jpg', alt: 'People enjoying time together at Ev Church' },
  { key: 'carousel-c842f7b4', filePath: 'homepage/carousel-c842f7b4.jpg', alt: 'Warm community gathering' },
  { key: 'carousel-9a8d8943', filePath: 'homepage/carousel-9a8d8943.jpg', alt: 'People laughing together at Ev Church' },
  { key: 'carousel-db9ac570', filePath: 'homepage/carousel-db9ac570.jpg', alt: 'Small group discussion at Ev Church' },

  // Campus images
  { key: 'central-photo-1', filePath: 'campus-central/photo-3b4be562.jpg', alt: 'Ev Church Central campus' },
  { key: 'unichurch-photo-1', filePath: 'campus-unichurch/photo-3cb597b9.jpg', alt: 'Ev Church Unichurch campus' },

  // Kids
  { key: 'ev-kids-banner', filePath: 'kids/ev-kids-banner.png', alt: 'Children enjoying Ev Kids program' },

  // Youth
  { key: 'ev-youth-banner', filePath: 'youth/ev-youth-banner.png', alt: 'Ev Youth community of teenagers' },
  { key: 'youthleaders-all', filePath: 'youth/youthleaders-all.jpg', alt: 'Ev Youth leaders team' },
  { key: 'youthleaders-fun', filePath: 'youth/youthleaders-fun.jpg', alt: 'Youth leaders having fun together' },
  { key: 'youthleaders-junior1', filePath: 'youth/youthleaders-junior1.jpg', alt: 'Junior Youth leaders' },
  { key: 'youthleaders-senior', filePath: 'youth/youthleaders-senior.jpg', alt: 'Senior Youth leaders' },

  // Newish
  { key: 'newish-connect-banner', filePath: 'newish/newish-connect-banner.jpg', alt: 'People connecting at Newish Connect event' },

  // Explaining Christianity
  { key: 'ec-banner', filePath: 'explaining-christianity/explaining-christianity-banner.jpg', alt: 'People gathered for Explaining Christianity course' },

  // Connect Groups
  { key: 'connect-groups-banner', filePath: 'connect-groups/connect-groups-banner.jpg', alt: 'People gathered in a Connect Group' },

  // Team photos
  { key: 'team-rowan', filePath: 'team/rowan-hilsden.jpg', alt: 'Rowan Hilsden, Senior Pastor' },
  { key: 'team-andrew', filePath: 'team/andrew-coombridge.jpg', alt: 'Andrew Coombridge, Pastor' },
  { key: 'team-ryan', filePath: 'team/ryan-green.jpg', alt: 'Ryan Green, Pastor' },
  { key: 'team-austin', filePath: 'team/austin-ibarra.jpg', alt: 'Austin Ibarra, Pastor' },
  { key: 'team-ming', filePath: 'team/ming-yong.jpg', alt: 'Ming Yong, Pastor & Kids Coordinator' },
  { key: 'team-steve', filePath: 'team/steve-mullins.jpg', alt: 'Steve Mullins, Executive Manager' },
  { key: 'team-jared', filePath: 'team/jared-stevenson.jpg', alt: 'Jared Stevenson, Captivate Music Director' },
  { key: 'team-ioana', filePath: 'team/ioana-selea.jpg', alt: 'Ioana Selea, Design and Social' },
  { key: 'team-tim', filePath: 'team/tim-thang.jpg', alt: 'Tim Thang, Executive Assistant' },
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
        eyebrow: 'Christian Church in Auckland',
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
      metaTitle: 'Church in Auckland | Ev Church NZ | Sunday Services & Community',
      metaDescription: 'Looking for a church in Auckland? Ev Church is a community of Christ-followers meeting across Tāmaki Makaurau. Join us this Sunday or explore faith with us.',
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
      metaTitle: 'Plan Your Visit | Ev Church Auckland | What to Expect on Sunday',
      metaDescription: 'Planning to visit a church in Auckland? Ev Church meets across Tāmaki Makaurau each Sunday. Find a campus, see what to expect, and come as you are.',
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
        body: richText([
          'Ev Church is an evangelical church grounded in the gospel of Jesus Christ. We hold the Bible to be the supreme authority in all matters of faith and conduct, and we stand united with Christians around the world and throughout history.',
          'Read more about our core beliefs, including what we believe about God, Jesus Christ, the Bible, salvation, the Holy Spirit, and the church.',
        ]),
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
      metaTitle: 'About | Ev Church Auckland',
      metaDescription: 'Ev Church is a community of Christ-followers across Auckland, New Zealand. Learn about our mission, team, and what we believe.',
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
      metaTitle: 'Our 2030 Vision | Ev Church Auckland',
      metaDescription: 'We are asking God to do four big things by 2030: grow to 2030 people across 6 campuses, plant 8 new churches, train 30 gospel workers, and build a gospel training hub.',
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
      metaTitle: 'Contact | Ev Church Auckland',
      metaDescription: 'Get in touch with Ev Church. Find campus addresses, service times, and send us a message. We would love to hear from you.',
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
        layout: 'grid4',
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
      metaTitle: 'Ev Kids | Ev Church Auckland',
      metaDescription: 'Ev Kids provides a safe, fun, and engaging environment for children aged 0 to 12 every Sunday across all Ev Church campuses.',
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
        layout: 'grid4',
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
      metaTitle: 'Ev Youth | Ev Church Auckland',
      metaDescription: 'Ev Youth is a vibrant community for teenagers. Junior Youth (Years 7-9) and Senior Youth (Years 10-13) meet weekly across Auckland.',
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
        layout: 'grid4',
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
      metaTitle: 'Newish Connect | Ev Church Auckland',
      metaDescription: 'Newish Connect is a relaxed gathering for anyone new or newish to Ev Church. Meet the team, hear the vision, and find your place.',
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
        layout: 'grid4',
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
      metaTitle: 'Explaining Christianity | Ev Church Auckland',
      metaDescription: 'A relaxed, no-pressure course exploring the basics of the Christian faith. Ask questions, hear stories, and discover what Christianity is really about.',
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
        layout: 'grid4',
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
      metaTitle: 'Easter at Ev Church | Ev Church Auckland',
      metaDescription: 'Celebrate Easter at Ev Church. Special services across all three Auckland campuses with live music, an inspiring message, and activities for the whole family.',
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
        layout: 'grid4',
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
      metaTitle: 'Connect Groups | Ev Church Auckland',
      metaDescription: 'Connect Groups are the heart of community at Ev Church. Small gatherings in homes across Auckland where real friendships are formed.',
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
      metaTitle: 'Next Steps | Ev Church Auckland',
      metaDescription: 'Find your place at Ev Church. Explore courses, connect groups, and programs for every season of life. Your next step starts here.',
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
