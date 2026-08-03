import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import type { RockConnectionSignupAttribute } from './types'

const MAX_TOKEN_BYTES = 96_000
const MAX_LIFETIME_MS = 10 * 60_000
const CLOCK_SKEW_MS = 30_000
const PURPOSE = 'rock-connection-signup' as const
const AUDIENCE = 'ev.church' as const
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export type RockConnectionContextAttribute = Pick<
  RockConnectionSignupAttribute,
  | 'attributeGuid'
  | 'fieldTypeGuid'
  | 'key'
  | 'isRequired'
  | 'configurationValues'
>

export type RockConnectionContext = {
  version: 1
  purpose: typeof PURPOSE
  audience: typeof AUDIENCE
  pageGuid: string
  blockGuid: string
  opportunityGuid: string
  sessionGuid: string
  interactionGuid: string
  nonce: string
  campuses: string[]
  selectedCampusId: number | null
  displayHomePhone: boolean
  displayMobilePhone: boolean
  attributes: RockConnectionContextAttribute[]
  issuedAt: number
  expiresAt: number
}

type SigningKey = { kid: string; secret: Buffer }

function invalid(): never {
  throw new Error('Invalid connection context')
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function keyRing(): SigningKey[] {
  const value = process.env.ROCK_CONNECTION_CONTEXT_KEYS?.trim()
  if (!value) throw new Error('ROCK_CONNECTION_CONTEXT_KEYS is required')
  const keys = value.split(',').map((entry) => {
    const separator = entry.indexOf(':')
    if (separator < 1) throw new Error('ROCK_CONNECTION_CONTEXT_KEYS is invalid')
    const kid = entry.slice(0, separator).trim()
    const encoded = entry.slice(separator + 1).trim()
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(kid)) {
      throw new Error('ROCK_CONNECTION_CONTEXT_KEYS is invalid')
    }
    const secret = Buffer.from(encoded, 'base64')
    if (secret.length < 32 || secret.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
      throw new Error('ROCK_CONNECTION_CONTEXT_KEYS is invalid')
    }
    return { kid, secret }
  })
  if (keys.length < 1 || keys.length > 2 || new Set(keys.map(({ kid }) => kid)).size !== keys.length) {
    throw new Error('ROCK_CONNECTION_CONTEXT_KEYS is invalid')
  }
  return keys
}

function sign(input: string, secret: Buffer): string {
  return createHmac('sha256', secret).update(input).digest('base64url')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validAttribute(value: unknown): value is RockConnectionContextAttribute {
  if (!isRecord(value) || !exactKeys(value, ['attributeGuid', 'fieldTypeGuid', 'key', 'isRequired', 'configurationValues'])) return false
  if (!GUID_PATTERN.test(String(value.attributeGuid)) || !GUID_PATTERN.test(String(value.fieldTypeGuid))) return false
  if (typeof value.key !== 'string' || value.key.length < 1 || value.key.length > 100 || typeof value.isRequired !== 'boolean' || !isRecord(value.configurationValues)) return false
  const config = value.configurationValues
  return Object.keys(config).length <= 100 && Object.values(config).every((item) => typeof item === 'string' && item.length <= 20_000)
}

function parseContext(value: unknown, now: number): RockConnectionContext {
  if (!isRecord(value) || !exactKeys(value, [
    'version', 'purpose', 'audience', 'pageGuid', 'blockGuid', 'opportunityGuid',
    'sessionGuid', 'interactionGuid', 'nonce', 'campuses', 'selectedCampusId',
    'displayHomePhone', 'displayMobilePhone', 'attributes', 'issuedAt', 'expiresAt',
  ])) invalid()
  const issuedAt = value.issuedAt
  const expiresAt = value.expiresAt
  if (
    value.version !== 1 || value.purpose !== PURPOSE || value.audience !== AUDIENCE ||
    !GUID_PATTERN.test(String(value.pageGuid)) || !GUID_PATTERN.test(String(value.blockGuid)) ||
    !GUID_PATTERN.test(String(value.opportunityGuid)) || !GUID_PATTERN.test(String(value.sessionGuid)) ||
    !GUID_PATTERN.test(String(value.interactionGuid)) || typeof value.nonce !== 'string' ||
    !/^[A-Za-z0-9_-]{24,128}$/.test(value.nonce) || !Array.isArray(value.campuses) ||
    value.campuses.length > 100 || !value.campuses.every((campus) => typeof campus === 'string' && /^\d{1,10}$/.test(campus)) ||
    !(value.selectedCampusId === null || Number.isSafeInteger(value.selectedCampusId)) ||
    typeof value.displayHomePhone !== 'boolean' || typeof value.displayMobilePhone !== 'boolean' ||
    !Array.isArray(value.attributes) || value.attributes.length > 100 || !value.attributes.every(validAttribute) ||
    !Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) ||
    (expiresAt as number) <= now || (issuedAt as number) > now + CLOCK_SKEW_MS || (expiresAt as number) - (issuedAt as number) > MAX_LIFETIME_MS
  ) invalid()
  return value as RockConnectionContext
}

export function createRockConnectionNonce(): string {
  return randomBytes(24).toString('base64url')
}

export function createRockConnectionContextToken(context: RockConnectionContext, now = Date.now()): string {
  parseContext(context, now)
  const key = keyRing()[0]
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: key.kid, typ: 'ROCK-CONNECTION-CONTEXT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(context)).toString('base64url')
  const input = `${header}.${payload}`
  return `${input}.${sign(input, key.secret)}`
}

export function verifyRockConnectionContextToken(token: string, now = Date.now()): RockConnectionContext {
  if (typeof token !== 'string' || Buffer.byteLength(token) > MAX_TOKEN_BYTES) invalid()
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((part) => !part)) invalid()
  const [encodedHeader, encodedPayload, suppliedSignature] = parts
  let header: unknown
  let payload: unknown
  try {
    const headerText = Buffer.from(encodedHeader, 'base64url').toString('utf8')
    const payloadText = Buffer.from(encodedPayload, 'base64url').toString('utf8')
    header = JSON.parse(headerText)
    payload = JSON.parse(payloadText)
    if (Buffer.from(JSON.stringify(header)).toString('base64url') !== encodedHeader || Buffer.from(JSON.stringify(payload)).toString('base64url') !== encodedPayload) invalid()
  } catch {
    invalid()
  }
  if (!isRecord(header) || !exactKeys(header, ['alg', 'kid', 'typ']) || header.alg !== 'HS256' || header.typ !== 'ROCK-CONNECTION-CONTEXT' || typeof header.kid !== 'string') invalid()
  const key = keyRing().find(({ kid }) => kid === header.kid)
  if (!key) invalid()
  const expected = Buffer.from(sign(`${encodedHeader}.${encodedPayload}`, key.secret))
  const supplied = Buffer.from(suppliedSignature)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) invalid()
  return parseContext(payload, now)
}
