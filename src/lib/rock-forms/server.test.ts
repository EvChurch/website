import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { submitRockForm } from './server'
import type { RockFormContext } from './types'

const context: RockFormContext = {
  version: 1,
  workflowTypeGuid: '11111111-1111-4111-8111-111111111111',
  workflowGuid: null,
  sessionGuid: '22222222-2222-4222-8222-222222222222',
  interactionGuid: '33333333-3333-4333-8333-333333333333',
  actionTypeGuid: '44444444-4444-4444-8444-444444444444',
  actionStartDateTime: '2026-09-08T10:00:00+12:00',
  initialFieldValues: {},
  allowedFields: [],
  buttonTitles: ['Submit'],
  expiresAt: Date.now() + 60_000,
}

describe('Rock person-entry transport', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
      .mockResolvedValueOnce(Response.json([{
        Guid: context.workflowTypeGuid,
        Name: 'Survey',
      }]))
      .mockResolvedValueOnce(Response.json({ noActionMessage: 'Complete' }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each(['1990-05-23', '1990-05-23T00:00:00', '1990-05-23T00:00:00+12:00'])(
    'sends DOB %s in the Rock contract without discarding the respondent', async (personBirthDate) => {
    await submitRockForm({
      context,
      fieldValues: {},
      personEntryValues: {
        person: {
          firstName: 'Test',
          lastName: 'Respondent',
          email: 'respondent@example.invalid',
          personBirthDate,
        },
      },
      button: 'Submit',
    })

    const request = JSON.parse(fetchMock.mock.calls[1][1].body)
    const values = JSON.parse(request.componentData.personEntryValues)
    // Rock 19.2 PersonBasicEditorBag uses DatePartsPickerValueBag. A string
    // makes FromJsonOrNull discard the entire person-entry object, while the
    // action still saves the survey answers and reports completion.
    expect(values.person.personBirthDate).toEqual({ year: 1990, month: 5, day: 23 })
    expect(values.person.email).toBe('respondent@example.invalid')
  })

  it('converts spouse DOB and signed-in demographic defaults to Rock bags', async () => {
    await submitRockForm({
      context: { ...context, personId: 123 },
      fieldValues: {},
      personEntryValues: {
        person: { personRace: context.sessionGuid, personEthnicity: context.interactionGuid },
        spouse: { personBirthDate: '2000-02-29' },
      },
      button: 'Submit',
    })
    const request = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(request.__context.pageParameters.PersonId).toBe('123')
    expect(JSON.parse(request.componentData.personEntryValues)).toMatchObject({
      person: {
        personBirthDate: null,
        personRace: { value: context.sessionGuid },
        personEthnicity: { value: context.interactionGuid },
      },
      spouse: { personBirthDate: { year: 2000, month: 2, day: 29 } },
    })
  })

  it('preserves forms without person entry', async () => {
    await submitRockForm({ context, fieldValues: {}, personEntryValues: null, button: 'Submit' })
    const request = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(JSON.parse(request.componentData.personEntryValues)).toBeNull()
  })

  it.each(['1990-02-30', '1900-02-29', 'not-a-date'])(
    'rejects invalid DOB %s before calling Rock', async (personBirthDate) => {
      await expect(submitRockForm({
        context,
        fieldValues: {},
        personEntryValues: { person: { personBirthDate } },
        button: 'Submit',
      })).rejects.toThrow('Enter a valid date of birth')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
})
