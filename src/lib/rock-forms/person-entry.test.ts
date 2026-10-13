import { describe, expect, it } from 'vitest'
import { parseRockInteractiveAction } from './schema'
import { ROCK_ENTRY_FORM_COMPONENT_URL } from './constants'
import { toRockPersonEntryBag } from './person-entry'

describe('Rock person-entry response boundary', () => {
  it('round-trips Rock date and list-item bags through the website schema', () => {
    const values = {
      person: {
        firstName: 'Test',
        personBirthDate: { year: 2000, month: 2, day: 29 },
        personRace: { value: '11111111-1111-4111-8111-111111111111', text: 'Option' },
      },
      spouse: { personBirthDate: { year: 1990, month: 12, day: 31 } },
    }
    const parsed = parseRockInteractiveAction({
      actionTypeGuid: 'action-guid',
      actionStartDateTime: '2026-09-08T00:00:00',
      actionData: {
        componentUrl: ROCK_ENTRY_FORM_COMPONENT_URL,
        componentConfiguration: {},
        componentData: { personEntryValues: JSON.stringify(values) },
      },
    })
    expect(parsed.initialPersonEntryValues).toMatchObject({
      person: { personBirthDate: '2000-02-29', personRace: values.person.personRace.value },
      spouse: { personBirthDate: '1990-12-31' },
    })
    expect(toRockPersonEntryBag(parsed.initialPersonEntryValues)).toMatchObject({
      person: { personBirthDate: values.person.personBirthDate },
      spouse: values.spouse,
    })
  })

  it('accepts null person defaults from Rock', () => {
    const parsed = parseRockInteractiveAction({
      actionTypeGuid: 'action-guid',
      actionStartDateTime: '2026-09-08T00:00:00',
      actionData: {
        componentUrl: ROCK_ENTRY_FORM_COMPONENT_URL,
        componentConfiguration: {},
        componentData: { personEntryValues: '{"person":null,"spouse":null}' },
      },
    })
    expect(parsed.initialPersonEntryValues?.person.personBirthDate).toBeNull()
  })
})
