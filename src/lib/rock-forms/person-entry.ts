import type { RockListItem, RockPersonBasicValues, RockPersonEntryValues } from './types'

// Rock's PersonBasicEditorBag uses DatePartsPickerValueBag, while the website
// date picker and People API use ISO strings. Keep the conversion at the boundary.
type RockDateParts = { year: number; month: number; day: number }
type RockPersonBasicBag = Omit<RockPersonBasicValues, 'personBirthDate' | 'personRace' | 'personEthnicity'> & {
  personBirthDate?: RockDateParts | null
  personRace?: RockListItem | null
  personEthnicity?: RockListItem | null
}
export type RockPersonEntryBag = Omit<RockPersonEntryValues, 'person' | 'spouse'> & {
  person: RockPersonBasicBag | null
  spouse?: RockPersonBasicBag | null
}

function formatDate({ year, month, day }: RockDateParts): string {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  if (
    !Number.isInteger(year) || year < 1 || year > 9999 ||
    !Number.isInteger(month) || !Number.isInteger(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
  ) {
    throw new Error('Enter a valid date of birth')
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function toPersonBag(person: RockPersonBasicValues): RockPersonBasicBag {
  const bag: RockPersonBasicBag = {
    ...person,
    personBirthDate: null,
    personRace: person.personRace ? { value: person.personRace, text: '' } : null,
    personEthnicity: person.personEthnicity ? { value: person.personEthnicity, text: '' } : null,
  }
  const value = person.personBirthDate
  if (!value) return bag
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T[\d:.+Z-]+)?$/.exec(value)
  if (!match) throw new Error('Enter a valid date of birth')
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  formatDate(parts)
  return { ...bag, personBirthDate: parts }
}

export function toRockPersonEntryBag(values: RockPersonEntryValues | null): RockPersonEntryBag | null {
  if (!values) return null
  return {
    ...values,
    person: toPersonBag(values.person),
    spouse: values.spouse ? toPersonBag(values.spouse) : null,
  }
}

export function fromRockPersonEntryBag(values: RockPersonEntryBag | null): RockPersonEntryValues | null {
  if (!values) return null
  const fromPerson = (person: RockPersonBasicBag): RockPersonBasicValues => ({
    ...person,
    personBirthDate: person.personBirthDate ? formatDate(person.personBirthDate) : null,
    personRace: person.personRace?.value || null,
    personEthnicity: person.personEthnicity?.value || null,
  })
  return {
    ...values,
    person: fromPerson(values.person || {}),
    spouse: values.spouse ? fromPerson(values.spouse) : null,
  }
}
