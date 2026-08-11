export type PassageTextSegment =
  | { type: 'text'; value: string }
  | { type: 'verse'; number: string }

const VERSE_MARKER = /\[(\d+)\]/gu

export function parsePassageText(value: string): PassageTextSegment[] {
  const segments: PassageTextSegment[] = []
  let textStart = 0

  for (const match of value.matchAll(VERSE_MARKER)) {
    const markerStart = match.index
    if (markerStart > textStart) {
      segments.push({ type: 'text', value: value.slice(textStart, markerStart) })
    }
    segments.push({ type: 'verse', number: match[1] })
    textStart = markerStart + match[0].length
  }

  if (textStart < value.length) {
    segments.push({ type: 'text', value: value.slice(textStart) })
  }

  return segments
}
