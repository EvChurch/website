import { describe, expect, it } from 'vitest'
import { appendDeclineNote, normalizedDeclineNote, requiresDeclineNote } from './decline-notes'

describe('decline notes', () => {
  it('requires comments only for the Other preset', () => {
    expect(requiresDeclineNote('Other')).toBe(true)
    expect(requiresDeclineNote(' other reason ')).toBe(true)
    expect(requiresDeclineNote("I'm sick")).toBe(false)
    expect(requiresDeclineNote('Serving Elsewhere')).toBe(false)
  })

  it('trims and bounds plain text comments', () => {
    expect(normalizedDeclineNote('  A schedule conflict  ')).toBe('A schedule conflict')
    for (const value of [undefined, null, 12, '', ' \n ', 'x'.repeat(501), 'bad\u0000text']) {
      expect(normalizedDeclineNote(value)).toBeNull()
    }
    expect(normalizedDeclineNote('x'.repeat(500))).toHaveLength(500)
  })

  it('preserves existing notes and escapes new markup', () => {
    expect(appendDeclineNote('<p>Existing</p>', '<script> &\nnext')).toBe(
      '<p>Existing</p><p>Decline note: &lt;script&gt; &amp;<br>next</p>',
    )
  })
})
