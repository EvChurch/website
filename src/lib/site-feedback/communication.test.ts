import { describe, expect, it } from 'vitest'
import { buildFeedbackCommunication, communicationInput, validateCommunicationItems, type CommunicationFeedback, type CommunicationItem } from './communication'

const item: CommunicationItem = { feedbackId: 1, kind: 'finished', title: 'Sermon downloads', message: 'You can now download sermon audio.' }
const feedback: CommunicationFeedback = { id: 1, email: 'Person@example.com', resolutionStatus: 'resolved', triagedAt: '2026-09-08', deliveryPhase: 'verified', deliveryVerificationResult: 'passed' }

describe('submitter communications', () => {
  it('uses only the submitter email and the agreed reply address and sender', () => {
    const to = validateCommunicationItems([item], [feedback])
    const email = buildFeedbackCommunication(to, [item], 'Old name <website@ev.church>')
    expect(email.to).toBe('person@example.com')
    expect(email.replyTo).toBe('tataihono@ev.church')
    expect(email.from).toBe('Ev Church website team <website@ev.church>')
    expect(email.text).toContain(item.message)
    expect(email.text).not.toContain('feedbackId')
  })
  it('escapes agent text in HTML', () => {
    const email = buildFeedbackCommunication('person@example.com', [{ ...item, message: '<script>alert("hi")</script>' }], 'website@ev.church')
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
  })
  it('allows combined finished/closed outcomes for one submitter', () => {
    expect(validateCommunicationItems([item, { ...item, feedbackId: 2, kind: 'closed' }], [feedback,
      { ...feedback, id: 2, resolutionStatus: 'wont-fix' }])).toBe('person@example.com')
  })
  it('rejects mixed recipients, duplicate IDs and unverified finished messages', () => {
    expect(() => validateCommunicationItems([item, { ...item, feedbackId: 2 }], [feedback,
      { ...feedback, id: 2, email: 'other@example.com' }])).toThrow('same submitter')
    expect(() => validateCommunicationItems([item, item], [feedback])).toThrow('once')
    expect(() => validateCommunicationItems([item], [{ ...feedback, deliveryVerificationResult: 'pending' }])).toThrow('verified')
  })
  it('requires triage and sends only outcomes for immediately terminal feedback', () => {
    const triaged = { ...item, kind: 'triaged' as const }
    expect(() => validateCommunicationItems([triaged], [feedback])).toThrow('outcome email only')
    expect(() => validateCommunicationItems([triaged], [{ ...feedback, resolutionStatus: 'planned', triagedAt: null }])).toThrow('Record triage')
    expect(validateCommunicationItems([triaged], [{ ...feedback, resolutionStatus: 'planned' }])).toBe('person@example.com')
    expect(() => validateCommunicationItems([{ ...item, kind: 'closed' }], [feedback])).toThrow('closed-without')
  })
  it('rejects arbitrary recipients, headers and invalid kinds in input', () => {
    expect(communicationInput.safeParse({ items: [item], to: 'other@example.com' }).success).toBe(false)
    expect(communicationInput.safeParse({ items: [{ ...item, kind: 'progress' }] }).success).toBe(false)
    expect(communicationInput.safeParse({ items: [{ ...item, title: 'Title\nBcc: other@example.com' }] }).success).toBe(false)
  })
})
