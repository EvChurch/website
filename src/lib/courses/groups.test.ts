import { describe, expect, it } from 'vitest'
import { buildCourseInvitation, invitationTokenHash, normalizeInvitationEmail } from './groups'

describe('course invitation content and tokens', () => {
  it('normalizes verified-recipient matching and rejects malformed addresses', () => {
    expect(normalizeInvitationEmail('  A@Example.test ')).toBe('a@example.test')
    expect(() => normalizeInvitationEmail('not an email')).toThrow()
    expect(() => normalizeInvitationEmail('a@example.test\nBcc:x@example.test')).toThrow()
  })
  it('stores only a purpose-separated token digest', () => {
    expect(invitationTokenHash('opaque')).toMatch(/^[a-f0-9]{64}$/)
    expect(invitationTokenHash('opaque')).not.toContain('opaque')
    expect(invitationTokenHash('other')).not.toBe(invitationTokenHash('opaque'))
  })
  it('escapes authored names and includes both private-sharing notice and text alternative', () => {
    const message = buildCourseInvitation('a@example.test', '<group>', 'Course & study', 'https://example.test/join/token')
    expect(message.html).toContain('&lt;group&gt;')
    expect(message.html).not.toContain('<group>')
    expect(message.html).toContain('Course &amp; study')
    expect(message.text).toContain('including people who join later')
    expect(message.text).toContain('https://example.test/join/token')
  })
})
