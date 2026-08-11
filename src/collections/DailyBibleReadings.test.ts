import { describe, expect, it } from 'vitest'

import { readPublishedDailyBibleReadings } from './DailyBibleReadings'

function accessArgs(roles?: Array<'admin' | 'content-lead' | 'editor'>) {
  return {
    req: {
      user: roles ? { roles } : null,
    },
  } as Parameters<typeof readPublishedDailyBibleReadings>[0]
}

describe('DailyBibleReadings access', () => {
  it('limits public reads to published readings', () => {
    expect(readPublishedDailyBibleReadings(accessArgs())).toEqual({
      isPublished: { equals: true },
    })
  })

  it('lets Payload editors review unpublished readings', () => {
    expect(readPublishedDailyBibleReadings(accessArgs(['editor']))).toBe(true)
  })
})
