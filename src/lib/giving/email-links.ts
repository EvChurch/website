import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
const TOKEN_PATTERN = /^(?<checkoutId>[1-9][0-9]*)\.(?<expires>[1-9][0-9]*)\.(?<signature>[A-Za-z0-9_-]{43})$/u

function secret() {
  const value = process.env.GIVING_CHECKOUT_DIGEST_SECRET?.trim()
  if (!value || value.length < 32) throw new Error('Giving acknowledgement links are not configured')
  return value
}

function signature(payload: string) {
  return createHmac('sha256', secret()).update(`giving-bank-email-v1\0${payload}`).digest('base64url')
}

export function createGivingBankAcknowledgementUrl(checkoutId: number, now = new Date()) {
  if (!Number.isSafeInteger(checkoutId) || checkoutId < 1) throw new Error('Invalid checkout')
  const expires = Math.floor(now.getTime() / 1000) + TOKEN_TTL_SECONDS
  const payload = `${checkoutId}.${expires}`
  const token = `${payload}.${signature(payload)}`
  const configured = process.env.APP_BASE_URL?.trim()
  if (!configured) throw new Error('APP_BASE_URL is required')
  const base = new URL(configured)
  if (base.origin !== configured || base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash) throw new Error('APP_BASE_URL must be an HTTPS origin')
  return new URL(`/give/bank-transfer/confirm?token=${encodeURIComponent(token)}`, base).toString()
}

export function verifyGivingBankAcknowledgementToken(token: unknown, now = new Date()) {
  if (typeof token !== 'string' || token.length > 180) return null
  const match = TOKEN_PATTERN.exec(token)
  if (!match?.groups) return null
  const checkoutId = Number(match.groups.checkoutId)
  const expires = Number(match.groups.expires)
  if (!Number.isSafeInteger(checkoutId) || checkoutId < 1 || !Number.isSafeInteger(expires) || expires <= Math.floor(now.getTime() / 1000)) return null
  const payload = `${match.groups.checkoutId}.${match.groups.expires}`
  const expected = Buffer.from(signature(payload), 'base64url')
  const actual = Buffer.from(match.groups.signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  return { checkoutId, expiresAt: new Date(expires * 1000) }
}
