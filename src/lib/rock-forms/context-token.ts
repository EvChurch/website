import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import type { RockFormContext } from './types'

function getSigningSecret(): string {
  const secret = process.env.ROCK_FORM_SIGNING_SECRET || process.env.PAYLOAD_SECRET

  if (!secret) {
    throw new Error('ROCK_FORM_SIGNING_SECRET or PAYLOAD_SECRET is required')
  }

  return secret
}

function encryptionKey(): Buffer {
  return createHash('sha256').update(getSigningSecret()).digest()
}

export function createRockFormContextToken(context: RockFormContext): string {
  const initializationVector = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), initializationVector)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(context), 'utf8'),
    cipher.final(),
  ])

  return [
    'v2',
    initializationVector.toString('base64url'),
    encrypted.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.')
}

export function verifyRockFormContextToken(token: string): RockFormContext {
  const [version, encodedIv, encodedPayload, encodedTag, extra] = token.split('.')
  if (
    version !== 'v2' ||
    !encodedIv ||
    !encodedPayload ||
    !encodedTag ||
    extra
  ) {
    throw new Error('Invalid form context')
  }

  let context: RockFormContext
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(encodedIv, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encodedPayload, 'base64url')),
      decipher.final(),
    ])
    context = JSON.parse(decrypted.toString('utf8'))
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
