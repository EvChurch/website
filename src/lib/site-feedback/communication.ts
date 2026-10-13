import { z } from 'zod'

import type { FeedbackSubmission } from '@/payload-types'
import type { SiteFeedbackNotificationMessage } from './notification'

export const communicationInput = z.object({
  items: z.array(z.object({
    feedbackId: z.number().int().positive(),
    kind: z.enum(['triaged', 'finished', 'closed']),
    title: z.string().trim().min(1).max(120).regex(/^[^\r\n]+$/),
    message: z.string().trim().min(1).max(2_000),
  }).strict()).min(1).max(20),
}).strict()

export type CommunicationInput = z.infer<typeof communicationInput>
export type CommunicationItem = CommunicationInput['items'][number]
export type CommunicationFeedback = Pick<FeedbackSubmission,
  'id' | 'email' | 'resolutionStatus' | 'triagedAt' | 'deliveryPhase' | 'deliveryVerificationResult'>

export const FEEDBACK_REPLY_TO = 'tataihono@ev.church'
export const FEEDBACK_SENDER_NAME = 'Ev Church website team'

export function communicationStage(kind: CommunicationItem['kind']) {
  return kind === 'triaged' ? 'triaged' : 'outcome'
}

export function validateCommunicationItems(
  items: CommunicationItem[], feedback: CommunicationFeedback[],
): string {
  if (new Set(items.map(item => item.feedbackId)).size !== items.length) {
    throw new Error('Include each feedback submission once.')
  }
  if (items.length > 1 && items.some(item => item.kind === 'triaged')) {
    throw new Error('Only finished or closed outcomes can be combined.')
  }
  const recipients = new Set<string>()
  for (const item of items) {
    const doc = feedback.find(doc => doc.id === item.feedbackId)
    if (!doc) throw new Error('Feedback submission not found.')
    const terminal = ['resolved', 'wont-fix', 'duplicate'].includes(doc.resolutionStatus)
    if (item.kind === 'triaged' && (!doc.triagedAt || terminal)) {
      throw new Error('Record triage first; terminal feedback needs an outcome email only.')
    }
    if (item.kind === 'finished' && (doc.resolutionStatus !== 'resolved' ||
      doc.deliveryPhase !== 'verified' || doc.deliveryVerificationResult !== 'passed')) {
      throw new Error('Finished emails require a resolved, verified outcome.')
    }
    if (item.kind === 'closed' && !['wont-fix', 'duplicate'].includes(doc.resolutionStatus)) {
      throw new Error('Closed emails require a closed-without-implementation outcome.')
    }
    recipients.add(z.string().email().max(254).parse(doc.email.trim().toLowerCase()))
  }
  if (recipients.size !== 1) throw new Error('Combine feedback only for the same submitter email.')
  return [...recipients][0]
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}

export function buildFeedbackCommunication(
  to: string, items: CommunicationItem[], from: string,
): SiteFeedbackNotificationMessage {
  const email = z.string().email().parse(from.match(/<([^<>]+)>$/)?.[1] ?? from)
  const labels = { triaged: 'Received and triaged', finished: 'Finished', closed: 'Closed' }
  const intro = 'Thanks for helping us improve the Ev Church website. Here’s an update on your feedback.'
  const closing = 'If you have any questions, just reply to this email.'
  return {
    from: `${FEEDBACK_SENDER_NAME} <${email}>`,
    to,
    replyTo: FEEDBACK_REPLY_TO,
    subject: items.length > 1 ? 'An update on your Ev Church website feedback'
      : `${labels[items[0].kind]}: your Ev Church website feedback`,
    text: ['Hi,', '', intro, '', ...items.flatMap(item => [
      `${item.title} — ${labels[item.kind]}`, item.message, '',
    ]), closing, '', FEEDBACK_SENDER_NAME].join('\n'),
    html: `<p>Hi,</p><p>${escapeHtml(intro)}</p>${items.map(item =>
      `<h2>${escapeHtml(item.title)} — ${labels[item.kind]}</h2><p style="white-space:pre-wrap">${escapeHtml(item.message)}</p>`
    ).join('')}<p>${closing}</p><p>${FEEDBACK_SENDER_NAME}</p>`,
  }
}
