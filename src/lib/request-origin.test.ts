import { describe, expect, it } from 'vitest'

import { isSameOriginRequest } from './request-origin'

function request(origin: string | null, url: string) {
  return {
    headers: new Headers(origin ? { origin } : {}),
    nextUrl: new URL(url),
  }
}

describe('same-origin request validation', () => {
  it('requires the complete origin, including the scheme and port', () => {
    expect(isSameOriginRequest(request('https://www.ev.church', 'https://www.ev.church/path'))).toBe(true)
    expect(isSameOriginRequest(request('http://www.ev.church', 'https://www.ev.church/path'))).toBe(false)
    expect(isSameOriginRequest(request('https://www.ev.church:444', 'https://www.ev.church/path'))).toBe(false)
  })
})
