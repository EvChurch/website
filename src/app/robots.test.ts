import { describe, expect, it } from 'vitest'

import robots from './robots'

describe('robots', () => {
  it('keeps authentication and private application routes out of crawler audits', () => {
    expect(robots().rules).toEqual([
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin$',
          '/admin?',
          '/admin/',
          '/api$',
          '/api?',
          '/api/',
          '/auth$',
          '/auth?',
          '/auth/',
          '/member-auth$',
          '/member-auth?',
          '/member-auth/',
          '/member-avatar$',
          '/member-avatar?',
          '/member-avatar/',
          '/member-sign-in$',
          '/member-sign-in?',
          '/member-sign-in/',
          '/members$',
          '/members?',
          '/members/',
        ],
      },
    ])
  })
})
