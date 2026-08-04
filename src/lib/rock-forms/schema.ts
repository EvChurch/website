import type {
  RockFormButton,
  RockFormField,
  RockFormSection,
  RockInteractiveAction,
  RockPersonEntryConfiguration,
  RockPersonEntryValues,
} from './types'
import { ROCK_ENTRY_FORM_COMPONENT_URL } from './constants'

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function parseRockInteractiveAction(action: RockInteractiveAction) {
  const configuration = action.actionData?.componentConfiguration
  const data = action.actionData?.componentData

  if (
    action.actionData?.componentUrl !== ROCK_ENTRY_FORM_COMPONENT_URL ||
    !configuration ||
    !data ||
    !action.actionTypeGuid ||
    !action.actionStartDateTime
  ) {
    throw new Error(
      action.actionData?.exception ||
        action.actionData?.message?.content ||
        action.noActionMessage ||
        'Rock did not return an entry form action',
    )
  }

  return {
    actionTypeGuid: action.actionTypeGuid,
    actionStartDateTime: action.actionStartDateTime,
    headerHtml: configuration.headerHtml || '',
    footerHtml: configuration.footerHtml || '',
    sections: parseJson<RockFormSection[]>(configuration.sections, []),
    fields: parseJson<RockFormField[]>(configuration.fields, []),
    personEntry: parseJson<RockPersonEntryConfiguration | null>(
      configuration.personEntry,
      null,
    ),
    buttons: parseJson<RockFormButton[]>(configuration.buttons, []),
    initialFieldValues: parseJson<Record<string, string>>(data.fieldValues, {}),
    initialPersonEntryValues: parseJson<RockPersonEntryValues | null>(
      data.personEntryValues,
      null,
    ),
  }
}

export function replaceApiPersonDefaults(
  initial: RockPersonEntryValues | null,
): RockPersonEntryValues | null {
  if (!initial) return null

  return {
    ...initial,
    person: {
      ...initial.person,
      firstName: null,
      nickName: null,
      lastName: null,
      personGender: null,
      personRace: null,
      personEthnicity: null,
      personBirthDate: null,
      email: null,
      mobilePhoneNumber: null,
      mobilePhoneCountryCode: null,
      isMessagingEnabled: false,
    },
    spouse: null,
    campusGuid: null,
    address: null,
    maritalStatusGuid: null,
  }
}
