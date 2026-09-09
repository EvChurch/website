import type { Event } from '@/payload-types'

// Issue #293: this occurrence is synced from Rock event item 40. Keep the
// approved website programme and event window through subsequent Rock syncs.
export const WEEKEND_TOGETHER_START = '2026-11-06T06:00:00.000Z'
export const WEEKEND_TOGETHER_END = '2026-11-08T02:00:00.000Z'
export const WEEKEND_TOGETHER_HEADING = 'Weekend Together programme — 6–8 November 2026'

function textNode(text: string) {
  return { type: 'text', version: 1, text, format: 0, style: '', mode: 'normal', detail: 0 }
}

function block(type: 'heading' | 'paragraph', text: string, tag?: 'h2' | 'h3') {
  return {
    type, version: 1, format: '', indent: 0, direction: null,
    ...(tag ? { tag } : {}), children: [textNode(text)],
  }
}

export const WEEKEND_TOGETHER_PROGRAMME = [
  block('heading', WEEKEND_TOGETHER_HEADING, 'h2'),
  block('heading', 'Friday 6 November', 'h3'),
  block('paragraph', '7:00 pm — Arrival & Dessert'),
  block('paragraph', '8:00 pm — Session One'),
  block('paragraph', '9:15 pm — Board Games and chats'),
  block('heading', 'Saturday 7 November', 'h3'),
  block('paragraph', '8:30 am — Arrive — Coffee & Bagels'),
  block('paragraph', '9:15 am — Session Two'),
  block('paragraph', '10:30 am — Morning Tea'),
  block('paragraph', '11:00 am — Session Three'),
  block('paragraph', '12:30 pm — Lunch'),
  block('paragraph', '1:30 pm — Afternoon Activity'),
  block('paragraph', '3:00 pm — Free Time / Afternoon Tea'),
  block('paragraph', '3:45 pm — Optional organised Sports'),
  block('paragraph', '5:30 pm — Dinner'),
  block('paragraph', "6:30 pm — Kids' Games"),
  block('paragraph', '7:30 pm — Evening Programme'),
  block('paragraph', '9:30 pm — End'),
  block('heading', 'Sunday 8 November', 'h3'),
  block('paragraph', '9:30 am — Arrive — Coffee'),
  block('paragraph', '10:15 am — Church Service (regular service time)'),
  block('paragraph', 'Post-service — Lunch together'),
  block('paragraph', '3:00 pm — End — Clean up complete'),
]

type EventContent = Pick<Event, 'rockEventId' | 'slug' | 'startDate' | 'endDate' | 'summary'>

export function applyWeekendTogether2026<T extends EventContent>(event: T): Omit<T, 'startDate' | 'endDate' | 'summary'> & EventContent {
  // Do not carry the 2026 programme into a future recurrence of this event.
  if (event.rockEventId !== 40 || event.slug !== 'weekend-together'
    || !event.startDate || new Date(event.startDate).toISOString() !== WEEKEND_TOGETHER_START) return event

  const summary = event.summary ?? {
    root: { type: 'root', version: 1, format: '', indent: 0, direction: null, children: [] },
  }
  const hasProgramme = JSON.stringify(summary).includes(WEEKEND_TOGETHER_HEADING)
  return {
    ...event,
    startDate: WEEKEND_TOGETHER_START,
    endDate: WEEKEND_TOGETHER_END,
    summary: hasProgramme ? summary : {
      ...summary,
      root: { ...summary.root, children: [...summary.root.children, ...WEEKEND_TOGETHER_PROGRAMME] },
    },
  }
}
