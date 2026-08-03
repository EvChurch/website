import type { RockConnectionContext, RockConnectionContextAttribute } from './context-token'
import type { RockConnectionSignupRequestBag, RockPhoneValue } from './types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FIELD_TYPES = {
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

function invalid(): never {
  throw new Error('Invalid submission')
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid()
  return value as Record<string, unknown>
}

function onlyKeys(value: Record<string, unknown>, allowed: Set<string>): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) invalid()
}

function boundedString(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string') invalid()
  const normalized = value.trim()
  if ((required && !normalized) || normalized.length > max || /[\u0000]/.test(normalized)) invalid()
  return normalized
}

function phone(value: unknown): RockPhoneValue {
  const input = record(value)
  onlyKeys(input, new Set(['number', 'countryCode', 'isMessagingEnabled']))
  const number = boundedString(input.number, 40, true)
  const countryCode = input.countryCode == null || input.countryCode === '' ? null : boundedString(input.countryCode, 8)
  if (input.isMessagingEnabled != null && typeof input.isMessagingEnabled !== 'boolean') invalid()
  return { number, countryCode, isMessagingEnabled: input.isMessagingEnabled === true }
}

function configuredOptions(attribute: RockConnectionContextAttribute): string[] | null {
  for (const key of ['values', 'items', 'options']) {
    const raw = attribute.configurationValues[key]
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed) || parsed.length > 500) return null
      const values = parsed.flatMap((item): string[] => {
        if (typeof item === 'string') return [item]
        if (item && typeof item === 'object') {
          const candidate = (item as { value?: unknown }).value
          return typeof candidate === 'string' ? [candidate] : []
        }
        return []
      })
      if (values.length !== parsed.length) return null
      return values.length === new Set(values).size ? values : null
    } catch {
      return null
    }
  }
  return null
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function validateAttributeValue(attribute: RockConnectionContextAttribute, value: unknown): string {
  const maximum = attribute.fieldTypeGuid === FIELD_TYPES.text
    ? 500
    : attribute.fieldTypeGuid === FIELD_TYPES.memo
      ? 4_000
      : attribute.fieldTypeGuid === FIELD_TYPES.phone
        ? 50
        : attribute.fieldTypeGuid === FIELD_TYPES.url
          ? 2_048
          : 200
  const string = boundedString(value, maximum, attribute.isRequired)
  if (!string && !attribute.isRequired) return ''

  switch (attribute.fieldTypeGuid) {
    case FIELD_TYPES.text:
    case FIELD_TYPES.memo:
    case FIELD_TYPES.phone:
      return string
    case FIELD_TYPES.boolean:
      if (!['True', 'False'].includes(string)) invalid()
      return string
    case FIELD_TYPES.date:
      if (!isCalendarDate(string)) invalid()
      return string
    case FIELD_TYPES.integer:
      if (!/^-?\d{1,10}$/.test(string)) invalid()
      if (Number(string) < -2_147_483_648 || Number(string) > 2_147_483_647) invalid()
      return string
    case FIELD_TYPES.currency:
      if (!/^-?\d{1,10}(?:\.\d{1,2})?$/.test(string)) invalid()
      return string
    case FIELD_TYPES.url:
      try {
        const url = new URL(string)
        if (url.protocol !== 'https:' || url.username || url.password) invalid()
        return url.toString()
      } catch {
        invalid()
      }
    case FIELD_TYPES.singleSelect: {
      const allowed = configuredOptions(attribute)
      if (!allowed?.includes(string)) invalid()
      return string
    }
    case FIELD_TYPES.multiSelect: {
      const allowed = configuredOptions(attribute)
      const values = string.split(',').map((item) => item.trim()).filter(Boolean)
      if (!allowed || values.length > 50 || new Set(values).size !== values.length || values.some((item) => !allowed.includes(item))) invalid()
      return allowed.filter((item) => values.includes(item)).join(',')
    }
    default:
      invalid()
  }
}

export function validateRockConnectionSubmission(value: unknown, context: RockConnectionContext): RockConnectionSignupRequestBag {
  const input = record(value)
  onlyKeys(input, new Set(['firstName', 'lastName', 'email', 'campusId', 'homePhone', 'mobilePhone', 'comments', 'attributeValues']))

  const firstName = boundedString(input.firstName, 100, true)
  const lastName = boundedString(input.lastName, 100, true)
  const email = boundedString(input.email, 254, true)
  if (!EMAIL_PATTERN.test(email)) invalid()

  let campusId: number | null | undefined
  if (input.campusId == null || input.campusId === '') {
    campusId = context.campuses.length === 1 ? Number(context.campuses[0]) : context.selectedCampusId
  } else {
    const candidate = typeof input.campusId === 'string' && /^\d{1,10}$/.test(input.campusId) ? Number(input.campusId) : input.campusId
    if (!Number.isSafeInteger(candidate) || !context.campuses.includes(String(candidate))) invalid()
    campusId = candidate as number
  }
  if (campusId != null && !context.campuses.includes(String(campusId))) invalid()

  let homePhone: RockPhoneValue | null | undefined
  if (input.homePhone != null) {
    if (!context.displayHomePhone) invalid()
    homePhone = phone(input.homePhone)
  }
  let mobilePhone: RockPhoneValue | null | undefined
  if (input.mobilePhone != null) {
    if (!context.displayMobilePhone) invalid()
    mobilePhone = phone(input.mobilePhone)
  }
  const comments = input.comments == null || input.comments === '' ? null : boundedString(input.comments, 4_000)

  const submittedAttributes = input.attributeValues == null ? {} : record(input.attributeValues)
  if (Object.keys(submittedAttributes).length > 100) invalid()
  const known = new Map(context.attributes.map((attribute) => [attribute.key, attribute]))
  if (Object.keys(submittedAttributes).some((key) => !known.has(key))) invalid()
  const attributeValues: Record<string, string> = {}
  for (const attribute of context.attributes) {
    const submitted = submittedAttributes[attribute.key]
    if (submitted == null || submitted === '') {
      if (attribute.isRequired) invalid()
      attributeValues[attribute.key] = ''
      continue
    }
    attributeValues[attribute.key] = validateAttributeValue(attribute, submitted)
  }

  return {
    firstName,
    lastName,
    email,
    ...(campusId == null ? {} : { campusId }),
    ...(homePhone === undefined ? {} : { homePhone }),
    ...(mobilePhone === undefined ? {} : { mobilePhone }),
    ...(comments === null ? {} : { comments }),
    ...(context.attributes.length === 0 ? {} : { attributeValues }),
  }
}

export function sanitizeRockResponseMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4_000) || null
}
