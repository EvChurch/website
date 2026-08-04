import { describe, expect, it } from 'vitest'

import type { RockConnectionContext } from './context-token'
import { validateRockConnectionSubmission } from './validation'

const base: RockConnectionContext = {
  version: 1,
  purpose: 'rock-connection-signup',
  audience: 'ev.church',
  pageGuid: 'eab9cb2b-474f-4939-b665-e32b4d2e1bb2',
  blockGuid: '70f9eb00-5961-42bc-b1ea-dbcb8fce6369',
  opportunityGuid: '11111111-1111-4111-8111-111111111111',
  sessionGuid: '22222222-2222-4222-8222-222222222222',
  interactionGuid: '33333333-3333-4333-8333-333333333333',
  nonce: 'abcdefghijklmnopqrstuvwx',
  campuses: ['3'],
  selectedCampusId: 3,
  displayHomePhone: false,
  displayMobilePhone: true,
  attributes: [{ attributeGuid: '44444444-4444-4444-8444-444444444444', fieldTypeGuid: '9c204cd0-1233-41c5-818a-c5da439445aa', key: 'Note', isRequired: true, configurationValues: {} }],
  issuedAt: Date.now(),
  expiresAt: Date.now() + 60_000,
}

describe('Rock Connection submission validation', () => {
  it('constructs the exact key-based Rock 19.2 bag', () => {
    expect(validateRockConnectionSubmission({
      firstName: ' Ada ', lastName: ' Lovelace ', email: ' ADA@example.test ',
      campusId: 3,
      mobilePhone: { number: ' 021 123 456 ', countryCode: '+64', isMessagingEnabled: true },
      comments: 'Hello', attributeValues: { Note: 'Interested' },
    }, base)).toEqual({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ADA@example.test', campusId: 3,
      mobilePhone: { number: '021 123 456', countryCode: '+64', isMessagingEnabled: true },
      comments: 'Hello', attributeValues: { Note: 'Interested' },
    })
  })

  it.each([
    ['bad email', { firstName: 'A', lastName: 'B', email: 'bad', attributeValues: { Note: 'x' } }],
    ['campus swap', { firstName: 'A', lastName: 'B', email: 'a@b.test', campusId: 4, attributeValues: { Note: 'x' } }],
    ['hidden phone', { firstName: 'A', lastName: 'B', email: 'a@b.test', homePhone: { number: '1' }, attributeValues: { Note: 'x' } }],
    ['unknown attribute', { firstName: 'A', lastName: 'B', email: 'a@b.test', attributeValues: { Note: 'x', AdminOnly: 'secret' } }],
    ['missing required attribute', { firstName: 'A', lastName: 'B', email: 'a@b.test', attributeValues: {} }],
  ])('rejects %s before dispatch', (_name, values) => {
    expect(() => validateRockConnectionSubmission(values, base)).toThrow('Invalid submission')
  })

  it('accepts only real calendar dates and HTTPS URL attributes', () => {
    const dateAndUrlContext: RockConnectionContext = {
      ...base,
      attributes: [
        { attributeGuid: '44444444-4444-4444-8444-444444444444', fieldTypeGuid: '6b6aa175-4758-453f-8d83-fcd8044b5f36', key: 'VisitDate', isRequired: true, configurationValues: {} },
        { attributeGuid: '55555555-5555-5555-8555-555555555555', fieldTypeGuid: 'c0d0d7e2-c3b0-4004-abea-4bbfad10d5d2', key: 'Website', isRequired: true, configurationValues: {} },
      ],
    }
    const values = {
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test',
      attributeValues: { VisitDate: '2028-02-29', Website: 'https://example.test/path' },
    }
    expect(validateRockConnectionSubmission(values, dateAndUrlContext).attributeValues).toEqual({
      ...values.attributeValues,
      Website: 'https://example.test/path',
    })
    expect(() => validateRockConnectionSubmission({
      ...values,
      attributeValues: { ...values.attributeValues, VisitDate: '2027-02-29' },
    }, dateAndUrlContext)).toThrow('Invalid submission')
    expect(() => validateRockConnectionSubmission({
      ...values,
      attributeValues: { ...values.attributeValues, Website: 'http://example.test/path' },
    }, dateAndUrlContext)).toThrow('Invalid submission')
  })

  it('serializes optional blanks and multi-select values in initialized order', () => {
    const configured: RockConnectionContext = {
      ...base,
      attributes: [
        { attributeGuid: '44444444-4444-4444-8444-444444444444', fieldTypeGuid: '9c204cd0-1233-41c5-818a-c5da439445aa', key: 'OptionalNote', isRequired: false, configurationValues: {} },
        { attributeGuid: '55555555-5555-5555-8555-555555555555', fieldTypeGuid: 'bd0d9b57-2a41-4490-89ff-f01dab7d4904', key: 'Choices', isRequired: true, configurationValues: { values: '[{"value":"first","text":"First"},{"value":"second","text":"Second"},{"value":"third","text":"Third"}]' } },
      ],
    }
    expect(validateRockConnectionSubmission({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test',
      attributeValues: { Choices: 'third,first' },
    }, configured).attributeValues).toEqual({ OptionalNote: '', Choices: 'first,third' })
  })

  it('enforces the documented text and signed 32-bit integer bounds', () => {
    const configured: RockConnectionContext = {
      ...base,
      attributes: [
        { attributeGuid: '44444444-4444-4444-8444-444444444444', fieldTypeGuid: '9c204cd0-1233-41c5-818a-c5da439445aa', key: 'Text', isRequired: true, configurationValues: {} },
        { attributeGuid: '55555555-5555-5555-8555-555555555555', fieldTypeGuid: 'a75dfc58-7a1b-4799-bf31-451b2bbe38ff', key: 'Count', isRequired: true, configurationValues: {} },
      ],
    }
    const values = { firstName: 'A', lastName: 'B', email: 'a@b.test', attributeValues: { Text: 'x'.repeat(501), Count: '2147483648' } }
    expect(() => validateRockConnectionSubmission(values, configured)).toThrow('Invalid submission')
  })

  it('requires an explicit campus when several are available without a default', () => {
    const context = { ...base, campuses: ['3', '4'], selectedCampusId: null }
    expect(() => validateRockConnectionSubmission({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test',
      attributeValues: { Note: 'Interested' },
    }, context)).toThrow('Invalid submission')
  })
})
