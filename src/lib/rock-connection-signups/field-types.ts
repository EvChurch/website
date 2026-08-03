import type { RockConnectionSignupAttribute, RockListItem } from './types'

export const ROCK_CONNECTION_FIELD_TYPES = {
  text: '9c204cd0-1233-41c5-818a-c5da439445aa',
  memo: 'c28c7bf3-a552-4d77-9408-dedcf760ced0',
  singleSelect: '7525c4cb-ee6b-41d4-9b64-a08048d5a5c0',
  multiSelect: 'bd0d9b57-2a41-4490-89ff-f01dab7d4904',
  boolean: '1edafded-dfe6-4334-b019-6eecba89e05a',
  date: '6b6aa175-4758-453f-8d83-fcd8044b5f36',
  integer: 'a75dfc58-7a1b-4799-bf31-451b2bbe38ff',
  currency: '3ee69cbc-35ce-4496-88cc-8327a447603f',
  phone: '6b1908ec-12a2-463a-a7bd-970ce0faf097',
  url: 'c0d0d7e2-c3b0-4004-abea-4bbfad10d5d2',
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

function parseOptions(value: string | undefined): RockListItem[] | null {
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

  const maximum = kind === 'text'
    ? 500
    : kind === 'memo'
      ? 4_000
      : kind === 'phone'
        ? 50
        : kind === 'url'
          ? 2_048
          : 200
  const configuredMaximum = Number(attribute.configurationValues.maxcharacters)
  const maxLength = Number.isSafeInteger(configuredMaximum) && configuredMaximum > 0
    ? Math.min(maximum, configuredMaximum)
    : maximum
  if (kind === 'singleSelect' || kind === 'multiSelect') {
    const options = parseOptions(attribute.configurationValues.values)
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
