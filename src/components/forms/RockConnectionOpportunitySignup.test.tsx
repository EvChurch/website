import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { RockConnectionSignupSchema } from '@/lib/rock-connection-signups/types'
import {
  buildConnectionSubmissionValues,
  claimConnectionSubmission,
  emptyConnectionSignupValues,
  preserveConnectionSignupValues,
  ConnectionSignupFields,
  ConnectionSignupTerminal,
  RockConnectionOpportunitySignup,
  connectionSignupReducer,
} from './RockConnectionOpportunitySignup'

function schema(overrides: Partial<RockConnectionSignupSchema> = {}): RockConnectionSignupSchema {
  return {
    pageGuid: 'eab9cb2b-474f-4939-b665-e32b4d2e1bb2',
    blockGuid: '70f9eb00-5961-42bc-b1ea-dbcb8fce6369',
    blockTypeGuid: '35d5ef65-0b0d-4e99-82b5-3f5fc2e0344f',
    opportunityGuid: '11111111-1111-4111-8111-111111111111',
    opportunityName: 'Newish <script>alert(1)</script>',
    sessionGuid: '', interactionGuid: '', attributes: [],
    campuses: [
      { value: '3', text: 'Central' },
      { value: '2', text: 'North' },
      { value: '4', text: 'Unichurch' },
    ],
    commentFieldLabel: 'Anything else?', disableCaptchaSupport: true,
    displayHomePhone: true, displayMobilePhone: true, selectedCampusId: 3,
    firstName: '', lastName: '', email: '', homePhone: null, mobilePhone: null,
    ...overrides,
  }
}

describe('Rock Connection Opportunity signup UI', () => {
  it('includes initialized fields in the server-rendered HTML', () => {
    const initialized = schema({ opportunityName: 'Connect with us' })
    const markup = renderToStaticMarkup(
      <RockConnectionOpportunitySignup
        blockGuid={initialized.blockGuid}
        initialSchema={initialized}
        initialSiteKey="site-key"
      />,
    )

    expect(markup).toContain('aria-label="Connect with us"')
    expect(markup).not.toContain('>Connect with us<')
    expect(markup).toContain('First name')
    expect(markup).toContain('<form')
    expect(markup).toContain('<input')
    expect(markup).toContain('disabled=""')
    expect(markup).not.toContain('Loading signup')
    expect(markup).not.toContain('Complete the security check to begin')
  })

  it('preserves an initialized default among multiple campuses', () => {
    expect(emptyConnectionSignupValues(schema({ selectedCampusId: 2 })).campusId).toBe('2')
  })

  it('preserves entered values when a fresh context is required', () => {
    const current = {
      ...emptyConnectionSignupValues(schema()),
      firstName: 'Ada',
      campusId: '2',
      attributeValues: { kept: 'yes', removed: 'no' },
    }
    const refreshed = schema({
      attributes: [
        {
          attributeGuid: '77777777-7777-4777-8777-777777777777',
          fieldTypeGuid: '88888888-8888-4888-8888-888888888888',
          key: 'kept',
          name: 'Kept',
          description: '',
          isRequired: false,
          order: 0,
          configurationValues: {},
        },
      ],
    })

    expect(preserveConnectionSignupValues(refreshed, current)).toMatchObject({
      firstName: 'Ada',
      campusId: '2',
      attributeValues: { kept: 'yes' },
    })
  })

  it('renders ordered built-ins, campus, phones, and comments as text', () => {
    const markup = renderToStaticMarkup(
      <ConnectionSignupFields
        schema={schema({
          commentFieldLabel: 'Anything else? <script>alert(1)</script>',
        })}
        values={{ firstName: '', lastName: '', email: '', campusId: '', homePhone: {}, mobilePhone: {}, comments: '', attributeValues: {} }}
        onChange={() => undefined}
      />,
    )
    for (const label of ['First name', 'Last name', 'Email', 'Campus', 'Home phone', 'Mobile phone', 'Anything else?']) {
      expect(markup).toContain(label)
    }
    expect(markup).not.toContain('I agree to receive text messages')
    expect(markup).toContain('&lt;script&gt;')
    expect(markup).not.toContain('<script>')
  })

  it('hides a sole campus while preserving it in the submission', () => {
    const oneCampus = schema({ campuses: [{ value: '3', text: 'Central' }] })
    const values = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', campusId: '', homePhone: {}, mobilePhone: {}, comments: '', attributeValues: {} }
    const markup = renderToStaticMarkup(<ConnectionSignupFields schema={oneCampus} values={values} onChange={() => undefined} />)
    expect(markup).not.toContain('>Campus<')
    expect(buildConnectionSubmissionValues(oneCampus, values)).toMatchObject({ campusId: 3 })
  })

  it('renders focusable announced terminal states without a retry action', () => {
    const markup = renderToStaticMarkup(<ConnectionSignupTerminal kind="outcomeUnknown" message="Your request may have succeeded." />)
    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-live="assertive"')
    expect(markup).toContain('tabindex="-1"')
    expect(markup).toContain('href="/contact"')
    expect(markup).not.toMatch(/retry|submit again/i)
  })

  it('models start, edit, submit, definite error, success, and outcome-unknown states', () => {
    let state = connectionSignupReducer({ phase: 'start' }, { type: 'started' })
    expect(state.phase).toBe('editing')
    state = connectionSignupReducer(state, { type: 'submitting' })
    expect(state.phase).toBe('submitting')
    expect(connectionSignupReducer(state, { type: 'failed', message: 'Try later' })).toEqual({ phase: 'editing', error: 'Try later' })
    expect(connectionSignupReducer(state, { type: 'succeeded', message: 'Thanks' })).toEqual({ phase: 'success', message: 'Thanks' })
    expect(connectionSignupReducer(state, { type: 'outcomeUnknown' }).phase).toBe('outcomeUnknown')
  })

  it('claims a submission synchronously so duplicate clicks cannot dispatch twice', () => {
    const lock = { current: false }
    expect(claimConnectionSubmission(lock)).toBe(true)
    expect(claimConnectionSubmission(lock)).toBe(false)
  })

  it('uses fresh, distinct Turnstile actions for initialization and submission', async () => {
    const module = await import('./RockConnectionOpportunitySignup')
    expect(module.ROCK_CONNECTION_START_ACTION).toBe('rock-connection-signup-start')
    expect(module.ROCK_CONNECTION_SUBMIT_ACTION).toBe('rock-connection-signup-submit')
    expect(module.ROCK_CONNECTION_START_ACTION).not.toBe(module.ROCK_CONNECTION_SUBMIT_ACTION)
  })
})
