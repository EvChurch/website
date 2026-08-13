import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  record: vi.fn(),
}))

vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('@/lib/missing-paths', () => ({ recordMissingPublicPath: mocks.record }))

import NotFound from './not-found'

describe('frontend not found boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders only Return home without performing tracking side effects', () => {
    const html = renderToStaticMarkup(<NotFound />)
    expect(html).toContain('Return home')
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(mocks.after).not.toHaveBeenCalled()
    expect(mocks.record).not.toHaveBeenCalled()
  })
})
