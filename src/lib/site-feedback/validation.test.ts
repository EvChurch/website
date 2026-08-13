import { describe, expect, it } from 'vitest'

import {
  MAX_FEEDBACK_COMMENT_LENGTH,
  MAX_FEEDBACK_EMAIL_LENGTH,
  MAX_FEEDBACK_SOURCE_URL_LENGTH,
  MAX_POSTHOG_REPLAY_URL_LENGTH,
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
    postHogReplayUrl:
      'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42',
    ...overrides,
  }
}

describe('site feedback validation', () => {
  it('normalizes a bounded submission and omits an empty optional email', () => {
    expect(
      validateSiteFeedbackSubmission(
        valid(),
        origin,
        'https://us.posthog.com',
        'test-token',
      ),
    ).toEqual({
      comment: 'The event page was easy to use.',
      email: 'visitor@example.com',
      sourceUrl: 'https://www.ev.church/events?campus=central',
      postHogSessionId: '019ff7cd-46fd-725b-9590-cfceaf201eb3',
      postHogReplayUrl:
        'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42',
      turnstileToken: 'visitor-token',
    })

    expect(
      validateSiteFeedbackSubmission(
        valid({
          email: '   ',
          postHogReplayUrl: undefined,
        }),
        origin,
        'https://us.posthog.com',
        'test-token',
      ),
    ).toEqual(
      expect.not.objectContaining({
        email: expect.anything(),
        postHogSessionId: expect.anything(),
        postHogReplayUrl: expect.anything(),
      }),
    )
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
    [
      'a replay URL on another origin',
      valid({ postHogReplayUrl: 'https://evil.test/project/x/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3' }),
    ],
    [
      'a replay URL without a session ID',
      valid({ postHogReplayUrl: 'https://us.posthog.com/project/x/replay/' }),
    ],
    [
      'a replay URL for another project',
      valid({ postHogReplayUrl: 'https://us.posthog.com/project/other/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42' }),
    ],
    [
      'a replay URL with an unexpected path',
      valid({ postHogReplayUrl: 'https://us.posthog.com/foo/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42' }),
    ],
    [
      'a replay URL without a timestamp',
      valid({ postHogReplayUrl: 'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3' }),
    ],
    [
      'a replay URL with a malformed timestamp',
      valid({ postHogReplayUrl: 'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=soon' }),
    ],
    [
      'a replay URL with an unexpected query',
      valid({ postHogReplayUrl: 'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42&next=javascript%3Aalert(1)' }),
    ],
    [
      'a replay URL with a fragment',
      valid({ postHogReplayUrl: 'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42#javascript:alert(1)' }),
    ],
    [
      'an oversized replay URL',
      valid({ postHogReplayUrl: `https://us.posthog.com/${'x'.repeat(MAX_POSTHOG_REPLAY_URL_LENGTH)}` }),
    ],
  ])('rejects %s', (_name, input) => {
    expect(() =>
      validateSiteFeedbackSubmission(
        input,
        origin,
        'https://us.posthog.com',
        'test-token',
      ),
    ).toThrow(
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
        'https://us.posthog.com',
        'test-token',
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
