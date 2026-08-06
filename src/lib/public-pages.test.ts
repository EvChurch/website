import { describe, expect, it } from 'vitest'

import { isRetiredPageSlug } from './public-pages'

describe('isRetiredPageSlug', () => {
  it('retires the removed Next Steps landing page', () => {
    expect(isRetiredPageSlug('next-steps')).toBe(true)
  })

  it('keeps child pages public', () => {
    expect(isRetiredPageSlug('explaining-christianity')).toBe(false)
    expect(isRetiredPageSlug('newish')).toBe(false)
  })
})
