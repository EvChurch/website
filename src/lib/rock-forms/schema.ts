import type {
  RockFormButton,
  RockFormField,
  RockFormSection,
  RockInteractiveAction,
  RockPersonEntryConfiguration,
  RockPersonEntryValues,
  RockSignatureConfiguration,
} from './types'
import {
  ROCK_ENTRY_FORM_COMPONENT_URL,
  ROCK_SIGNATURE_COMPONENT_URL,
} from './constants'
import { fromRockPersonEntryBag, type RockPersonEntryBag } from './person-entry'

export function parseRockSignatureAction(
  action: RockInteractiveAction,
): RockSignatureConfiguration {
  const configuration = action.actionData?.componentConfiguration

  if (
    action.actionData?.componentUrl !== ROCK_SIGNATURE_COMPONENT_URL ||
    !action.actionTypeGuid ||
    !action.actionStartDateTime ||
    !configuration?.content ||
    !['0', '1'].includes(configuration.signatureType)
  ) {
    throw new Error(
      action.actionData?.exception ||
        action.actionData?.message?.content ||
        'Rock returned an invalid signature step',
    )
  }

  return {
    type: configuration.signatureType === '1' ? 'drawn' : 'typed',
    documentHtml: configuration.content,
    documentTerm: configuration.documentTerm || 'document',
    sendCopy: configuration.sendCopy?.toLowerCase() === 'true',
    legalName: configuration.legalName || '',
    email: configuration.signedByEmail || '',
  }
}

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
    initialPersonEntryValues: fromRockPersonEntryBag(
      parseJson<RockPersonEntryBag | null>(data.personEntryValues, null),
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

export function defaultPersonEntryValues(): RockPersonEntryValues {
  return {
    person: {},
    spouse: null,
    campusGuid: null,
    maritalStatusGuid: null,
    address: null,
  }
}
