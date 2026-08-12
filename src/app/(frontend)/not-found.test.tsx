import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  headers: vi.fn(),
  record: vi.fn(),
}))

vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('@/lib/missing-paths', () => ({ recordMissingPublicPath: mocks.record }))

import NotFound from './not-found'

describe('frontend not found boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders only Return home and schedules one eligible recording', async () => {
    mocks.headers.mockResolvedValue(new Headers({ 'x-ev-public-path': '/old' }))
    mocks.after.mockImplementation((callback: () => unknown) => callback())
    const html = renderToStaticMarkup(await NotFound())
    expect(html).toContain('Return home')
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(mocks.after).toHaveBeenCalledOnce()
    expect(mocks.record).toHaveBeenCalledWith('/old')
  })

  it('does not schedule recording without a trusted eligible path', async () => {
    mocks.headers.mockResolvedValue(new Headers({ 'x-ev-public-path': '/admin/missing' }))
    renderToStaticMarkup(await NotFound())
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('keeps rendering when a scheduled recording rejects', async () => {
    mocks.headers.mockResolvedValue(new Headers({ 'x-ev-public-path': '/old' }))
    mocks.after.mockImplementation((callback: () => Promise<unknown>) => {
      void callback().catch(() => undefined)
    })
    mocks.record.mockRejectedValue(new Error('database details'))
    expect(renderToStaticMarkup(await NotFound())).toContain('Return home')
  })
})
