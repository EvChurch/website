export const MAX_DECLINE_NOTE_LENGTH = 500

export function requiresDeclineNote(label: string): boolean {
  return /^(other|other reason)$/iu.test(label.trim())
}

export function normalizedDeclineNote(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const note = value.trim()
  if (!note || note.length > MAX_DECLINE_NOTE_LENGTH || /[\u0000-\u0008\u000b-\u001f\u007f]/u.test(note)) return null
  return note
}

export function appendDeclineNote(existing: string | null, note: string): string {
  // Rock's attendance Note is HTML. Preserve existing content and encode the
  // member's plain text rather than allowing them to submit markup.
  const encoded = note.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/\n/gu, '<br>')
  return `${existing ?? ''}<p>Decline note: ${encoded}</p>`
}
