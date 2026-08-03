import { createHmac, timingSafeEqual } from 'node:crypto'
import type { RockFormContext } from './types'

function getSigningSecret(): string {
  const secret = process.env.ROCK_FORM_SIGNING_SECRET || process.env.PAYLOAD_SECRET

  if (!secret) {
    throw new Error('ROCK_FORM_SIGNING_SECRET or PAYLOAD_SECRET is required')
  }

  return secret
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url')
}

export function createRockFormContextToken(context: RockFormContext): string {
  const payload = Buffer.from(JSON.stringify(context)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyRockFormContextToken(token: string): RockFormContext {
  const [payload, signature, extra] = token.split('.')

  if (!payload || !signature || extra) {
    throw new Error('Invalid form context')
  }

  const expected = Buffer.from(sign(payload))
  const supplied = Buffer.from(signature)

  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error('Invalid form context')
  }

  let context: RockFormContext
  try {
    context = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid form context')
  }

  if (
    context.version !== 1 ||
    !context.workflowTypeGuid ||
    !context.actionTypeGuid ||
    !context.actionStartDateTime ||
    context.expiresAt <= Date.now()
  ) {
    throw new Error('Expired or invalid form context')
  }

  return context
}
