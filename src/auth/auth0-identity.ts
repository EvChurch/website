import { hash } from 'node:crypto'
import type { User as Auth0User } from '@auth0/nextjs-auth0/types'

export interface Auth0Identity {
  identityKey: string
  issuer: string
  subject: string
  email: string
  name: string
}

export function auth0IdentityKey(issuer: string, subject: string) {
  return hash('sha256', `${issuer}\0${subject}`, 'base64url')
}

export function identityFromSessionUser(
  issuer: string,
  user: Auth0User,
): Auth0Identity | null {
  const subject = user.sub.trim()
  const email = user.email?.trim().toLowerCase()
  if (!issuer || !subject || !email || user.email_verified !== true) return null
  if (issuer.length > 512 || subject.length > 512 || email.length > 320) return null

  return {
    identityKey: auth0IdentityKey(issuer, subject),
    issuer,
    subject,
    email,
    name: user.name?.trim() || user.nickname?.trim() || email,
  }
}
