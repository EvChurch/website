export type PassageTextSegment =
  | { type: 'text'; value: string }
  | { type: 'verse'; number: string }

export interface PassageVerse {
  number: number | null
  text: string
}

export function parsePassageVerses(value: string): PassageVerse[] {
  const verses: PassageVerse[] = []
  let number: number | null = null
  let text = ''

  function appendVerse() {
    if (number !== null || text.trim()) verses.push({ number, text: text.trim() })
  }

  for (const segment of parsePassageText(value)) {
    if (segment.type === 'verse') {
      appendVerse()
      number = Number(segment.number)
      text = ''
    } else {
      text += segment.value
    }
  }
  appendVerse()
  return verses
}

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
