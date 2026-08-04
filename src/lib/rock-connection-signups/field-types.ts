import type { RockConnectionSignupAttribute, RockListItem } from './types'
import { ROCK_FIELD_TYPES } from '@/lib/rock-forms/field-types'

export const ROCK_CONNECTION_FIELD_TYPES = {
  text: ROCK_FIELD_TYPES.text,
  memo: ROCK_FIELD_TYPES.memo,
  singleSelect: ROCK_FIELD_TYPES.singleSelect,
  multiSelect: ROCK_FIELD_TYPES.multiSelect,
  boolean: ROCK_FIELD_TYPES.boolean,
  date: ROCK_FIELD_TYPES.date,
  integer: ROCK_FIELD_TYPES.integer,
  currency: ROCK_FIELD_TYPES.currency,
  phone: ROCK_FIELD_TYPES.phone,
  url: ROCK_FIELD_TYPES.url,
} as const

export type ConnectionAttributeControl =
  | {
      available: true
      kind:
        | 'text'
        | 'memo'
        | 'singleSelect'
        | 'multiSelect'
        | 'boolean'
        | 'date'
        | 'integer'
        | 'currency'
        | 'phone'
        | 'url'
      maxLength: number
      options?: RockListItem[]
    }
  | { available: false; reason: string }

const UNAVAILABLE = {
  available: false,
  reason: 'This signup includes a field that is not supported on the website.',
} as const

export function parseConnectionOptions(value: string | undefined): RockListItem[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 500) return null
    const options: RockListItem[] = []
    for (const item of parsed) {
      if (
        !item || typeof item !== 'object' || Array.isArray(item) ||
        typeof (item as { value?: unknown }).value !== 'string' ||
        typeof (item as { text?: unknown }).text !== 'string'
      ) return null
      const option = item as { value: string; text: string }
      if (!option.value || option.value.length > 200 || !option.text || option.text.length > 160) return null
      options.push({ value: option.value, text: option.text })
    }
    if (new Set(options.map(({ value }) => value)).size !== options.length) return null
    return options
  } catch {
    return null
  }
}

export function connectionAttributeMaxLength(
  fieldTypeGuid: string,
  configurationValues: Record<string, string>,
): number {
  const type = fieldTypeGuid.toLowerCase()
  const maximum = type === ROCK_CONNECTION_FIELD_TYPES.text
    ? 500
    : type === ROCK_CONNECTION_FIELD_TYPES.memo
      ? 4_000
      : type === ROCK_CONNECTION_FIELD_TYPES.phone
        ? 50
        : type === ROCK_CONNECTION_FIELD_TYPES.url
          ? 2_048
          : 200
  const configuredMaximum = Number(configurationValues.maxcharacters)
  return Number.isSafeInteger(configuredMaximum) && configuredMaximum > 0
    ? Math.min(maximum, configuredMaximum)
    : maximum
}

export function getConnectionAttributeControl(
  attribute: RockConnectionSignupAttribute,
): ConnectionAttributeControl {
  const type = attribute.fieldTypeGuid.toLowerCase()
  const kinds = new Map<string, Exclude<ConnectionAttributeControl, { available: false }>['kind']>([
    [ROCK_CONNECTION_FIELD_TYPES.text, 'text'],
    [ROCK_CONNECTION_FIELD_TYPES.memo, 'memo'],
    [ROCK_CONNECTION_FIELD_TYPES.singleSelect, 'singleSelect'],
    [ROCK_CONNECTION_FIELD_TYPES.multiSelect, 'multiSelect'],
    [ROCK_CONNECTION_FIELD_TYPES.boolean, 'boolean'],
    [ROCK_CONNECTION_FIELD_TYPES.date, 'date'],
    [ROCK_CONNECTION_FIELD_TYPES.integer, 'integer'],
    [ROCK_CONNECTION_FIELD_TYPES.currency, 'currency'],
    [ROCK_CONNECTION_FIELD_TYPES.phone, 'phone'],
    [ROCK_CONNECTION_FIELD_TYPES.url, 'url'],
  ])
  const kind = kinds.get(type)
  if (!kind) return UNAVAILABLE

  const maxLength = connectionAttributeMaxLength(
    attribute.fieldTypeGuid,
    attribute.configurationValues,
  )
  if (kind === 'singleSelect' || kind === 'multiSelect') {
    const options = parseConnectionOptions(attribute.configurationValues.values)
    if (!options) return UNAVAILABLE
    return { available: true, kind, maxLength, options }
  }
  return { available: true, kind, maxLength }
}

export function connectionSchemaAvailability(
  attributes: RockConnectionSignupAttribute[],
): { available: true } | { available: false; reason: string } {
  for (const attribute of attributes) {
    const control = getConnectionAttributeControl(attribute)
    if (!control.available) return control
  }
  return { available: true }
}
