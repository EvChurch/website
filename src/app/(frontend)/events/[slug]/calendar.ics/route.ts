import { buildEventCalendar } from '@/lib/event-sharing'
import { getEventBySlug } from '@/lib/events'

type Props = { params: Promise<{ slug: string }> }

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params
  const event = await getEventBySlug(slug)

  if (!event?.startDate) {
    return new Response('Event not found', { status: 404 })
  }

  return new Response(buildEventCalendar(event), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  })
}
