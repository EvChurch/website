import { describe, expect, it } from 'vitest'

import {
  MAX_FEEDBACK_COMMENT_LENGTH,
  MAX_FEEDBACK_EMAIL_LENGTH,
  MAX_FEEDBACK_SOURCE_URL_LENGTH,
  SiteFeedbackValidationError,
  validateSiteFeedbackSubmission,
} from './validation'

const origin = 'https://www.ev.church'

function valid(overrides: Record<string, unknown> = {}) {
  return {
    comment: '  The event page was easy to use.  ',
    email: '  visitor@example.com  ',
    sourceUrl: 'https://www.ev.church/events?campus=central',
    website: '',
    turnstileToken: 'visitor-token',
    ...overrides,
  }
}

describe('site feedback validation', () => {
  it('normalizes a bounded submission and omits an empty optional email', () => {
    expect(validateSiteFeedbackSubmission(valid(), origin)).toEqual({
      comment: 'The event page was easy to use.',
      email: 'visitor@example.com',
      sourceUrl: 'https://www.ev.church/events?campus=central',
      turnstileToken: 'visitor-token',
    })

    expect(
      validateSiteFeedbackSubmission(valid({ email: '   ' }), origin),
    ).toEqual(expect.not.objectContaining({ email: expect.anything() }))
  })

  it.each([
    ['a non-object body', null],
    ['an array body', []],
    ['an unexpected property', valid({ extra: true })],
    ['a blank comment', valid({ comment: '   ' })],
    [
      'an oversized comment',
      valid({ comment: 'x'.repeat(MAX_FEEDBACK_COMMENT_LENGTH + 1) }),
    ],
    ['a non-string email', valid({ email: 42 })],
    ['an invalid email', valid({ email: 'not-an-email' })],
    [
      'an oversized email',
      valid({ email: `${'a'.repeat(MAX_FEEDBACK_EMAIL_LENGTH)}@x.test` }),
    ],
    ['a missing source URL', valid({ sourceUrl: undefined })],
    [
      'an oversized source URL',
      valid({
        sourceUrl: `${origin}/${'x'.repeat(MAX_FEEDBACK_SOURCE_URL_LENGTH)}`,
      }),
    ],
    ['a non-http source URL', valid({ sourceUrl: 'javascript:alert(1)' })],
    ['a cross-origin source URL', valid({ sourceUrl: 'https://evil.test/' })],
    ['a source URL with different port', valid({ sourceUrl: `${origin}:444/` })],
    ['a filled honeypot', valid({ website: 'https://spam.test' })],
    ['a missing Turnstile token', valid({ turnstileToken: '' })],
  ])('rejects %s', (_name, input) => {
    expect(() => validateSiteFeedbackSubmission(input, origin)).toThrow(
      SiteFeedbackValidationError,
    )
  })

  it('accepts exact field boundaries', () => {
    const email = `${'a'.repeat(MAX_FEEDBACK_EMAIL_LENGTH - 7)}@x.test`
    const sourceUrl = `${origin}/${'x'.repeat(
      MAX_FEEDBACK_SOURCE_URL_LENGTH - origin.length - 1,
    )}`

    expect(
      validateSiteFeedbackSubmission(
        valid({
          comment: 'x'.repeat(MAX_FEEDBACK_COMMENT_LENGTH),
          email,
          sourceUrl,
        }),
        origin,
      ),
    ).toMatchObject({
      comment: expect.stringMatching(
        new RegExp(`^x{${MAX_FEEDBACK_COMMENT_LENGTH}}$`),
      ),
      email,
      sourceUrl,
    })
  })
})
