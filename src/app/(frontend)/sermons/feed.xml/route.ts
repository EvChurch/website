import { getPayloadClient } from '@/lib/payload'
import { getSermonAudioUrl } from '@/lib/sermon-utils'

const SITE_URL = 'https://www.ev.church'

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function formatPubDate(dateString: string): string {
  return new Date(dateString).toUTCString()
}

export async function GET() {
  const payload = await getPayloadClient()

  const sermons = await payload.find({
    collection: 'sermons',
    where: { isPublished: { equals: true } },
    sort: '-publishedAt',
    depth: 1,
    limit: 1000,
  })

  const items = sermons.docs
    .filter((sermon) => getSermonAudioUrl(sermon.audio))
    .map((sermon) => {
      const audioUrl = getSermonAudioUrl(sermon.audio)
      const speakerName =
        sermon.audioSpeaker && typeof sermon.audioSpeaker === 'object' && 'name' in sermon.audioSpeaker
          ? (sermon.audioSpeaker.name as string)
          : ''
      const scriptures = Array.isArray(sermon.scriptures)
        ? sermon.scriptures
            .map((s) =>
              typeof s === 'object' && s !== null && 'name' in s
                ? s.name
                : '',
            )
            .filter(Boolean)
        : []

      const speaker = speakerName
      const scripture = scriptures.join(', ')
      const description = [speaker, scripture, sermon.publishedAt ? new Date(sermon.publishedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' | ')

      // Get series banner for episode artwork
      const seriesObj =
        Array.isArray(sermon.series) && sermon.series[0]
          ? sermon.series[0]
          : null
      let artworkUrl = ''
      if (
        seriesObj &&
        typeof seriesObj === 'object' &&
        'bannerImage' in seriesObj
      ) {
        const bannerImage = seriesObj.bannerImage
        if (
          bannerImage &&
          typeof bannerImage === 'object' &&
          'url' in bannerImage
        ) {
          artworkUrl = (bannerImage as { url: string }).url
        }
      }

      return `    <item>
      <title>${escapeXml(sermon.title)}</title>
      <description>${escapeXml(description)}</description>
      <pubDate>${sermon.publishedAt ? formatPubDate(sermon.publishedAt) : ''}</pubDate>
      <enclosure url="${escapeXml(audioUrl)}" type="audio/x-m4a"/>
      <link>${SITE_URL}/sermons/${sermon.slug}</link>
      <guid isPermaLink="false">${SITE_URL}/sermons/${sermon.slug}</guid>
      <itunes:author>${escapeXml(speaker)}</itunes:author>
      <itunes:subtitle>${escapeXml(description)}</itunes:subtitle>
      <itunes:summary>${escapeXml(description)}</itunes:summary>
      <itunes:explicit>no</itunes:explicit>${sermon.duration ? `
      <itunes:duration>${formatDuration(sermon.duration)}</itunes:duration>` : ''}${artworkUrl ? `
      <itunes:image href="${escapeXml(artworkUrl)}"/>` : ''}
    </item>`
    })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <atom:link href="${SITE_URL}/sermons/feed.xml" rel="self" type="application/rss+xml"/>
    <title>Ev Church - Sermons</title>
    <link>${SITE_URL}/sermons</link>
    <description>We are a bunch of people, convinced we're not perfect, captivated by the historical Jesus, excited about the future he offers, and eager to authentically share this hope with Auckland.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <copyright>Copyright ${new Date().getFullYear()} Ev Church</copyright>
    <itunes:author>Ev Church</itunes:author>
    <itunes:keywords>auckland, evangelical, church, christian, sermon, ev, jesus, god, hope, holy spirit</itunes:keywords>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <itunes:image href="${SITE_URL}/images/ev_church_podcast.jpg"/>
    <itunes:owner>
      <itunes:name>Ev Church</itunes:name>
      <itunes:email>info@ev.church</itunes:email>
    </itunes:owner>
    <itunes:category text="Religion &amp; Spirituality">
      <itunes:category text="Christianity"/>
    </itunes:category>
${items.join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  })
}
