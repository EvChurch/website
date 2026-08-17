import type { NextRequest } from 'next/server'

import type { GivingRequestMarker } from './contracts'

const MAX_BODY_BYTES = 8_192

export const GIVING_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const

export class InvalidGivingRequestError extends Error {
  constructor() {
    super('Invalid giving request')
    this.name = 'InvalidGivingRequestError'
  }
}

export function trustedGivingMutation(request: NextRequest, marker: GivingRequestMarker) {
  return request.headers.get('origin') === 'https://www.ev.church' &&
    request.headers.get('sec-fetch-site') === 'same-origin' &&
    request.headers.get('x-ev-giving-request') === marker
}

export function isGivingJson(request: NextRequest) {
  return request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json'
}

export async function boundedGivingJson(request: NextRequest) {
  const declared = request.headers.get('content-length')
  if (declared && (!Number.isSafeInteger(Number(declared)) || Number(declared) < 0 || Number(declared) > MAX_BODY_BYTES)) {
    throw new InvalidGivingRequestError()
  }
  if (!request.body) throw new InvalidGivingRequestError()
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let body = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new InvalidGivingRequestError()
    }
    body += decoder.decode(value, { stream: true })
  }
  body += decoder.decode()
  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new InvalidGivingRequestError()
  }
}
