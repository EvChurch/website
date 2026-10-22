import { createHmac } from 'node:crypto'

export class GivingSubmissionAdmissionError extends Error {
  constructor(public readonly reason: 'paused' | 'restart') {
    super('Giving submission unavailable')
  }
}

// Public, purpose-specific identifier; never expose the signing secret itself.
export function givingSubmissionVersion(secret = process.env.GIVING_CHECKOUT_DIGEST_SECRET): string | null {
  if (!secret || Buffer.byteLength(secret) < 32) return null
  return createHmac('sha256', secret).update('giving-submission-version-v1').digest('base64url')
}

export function requireCurrentGivingSubmission(headers: Pick<Headers, 'get'>) {
  if (process.env.GIVING_ACQUISITION_PAUSED === 'true') throw new GivingSubmissionAdmissionError('paused')
  const current = givingSubmissionVersion()
  if (!current) throw new GivingSubmissionAdmissionError('paused')
  if (headers.get('x-ev-giving-version') !== current) throw new GivingSubmissionAdmissionError('restart')
}
