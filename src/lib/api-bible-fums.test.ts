import { describe, expect, it, vi } from 'vitest'

import {
  apiBibleFumsTokens,
  reportApiBibleView,
  type ApiBibleFumsWindow,
} from './api-bible-fums'

describe('reportApiBibleView', () => {
  it('reads every token stored for a multi-passage reading', () => {
    expect(apiBibleFumsTokens('first-token\nsecond-token')).toEqual([
      'first-token',
      'second-token',
    ])
  })

  it('queues the FUMS view before the tracker loads', () => {
    const target: ApiBibleFumsWindow = {}

    reportApiBibleView(target, 'fums-token')

    expect(target.fumsData).toEqual([['trackView', 'fums-token']])
  })

  it('uses an already-loaded tracker', () => {
    const fums = vi.fn()

    reportApiBibleView({ fums }, 'fums-token')

    expect(fums).toHaveBeenCalledWith('trackView', 'fums-token')
  })
})
