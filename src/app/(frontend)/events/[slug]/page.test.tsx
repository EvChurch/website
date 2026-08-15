import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEventBySlug: vi.fn(),
  trackedNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/lib/events', () => ({
  formatEventDate: vi.fn(),
  getCampusName: vi.fn(),
  getEventBySlug: mocks.getEventBySlug,
  getEventImage: vi.fn(),
  getRegistrationHref: vi.fn(),
  isPastEvent: vi.fn(),
  toPlainText: vi.fn(),
}))

vi.mock('@/lib/tracked-not-found', () => ({
  trackedNotFound: mocks.trackedNotFound,
}))

import EventDetailPage from './page'

describe('event detail page', () => {
  beforeEach(() => {
    mocks.getEventBySlug.mockReset()
    mocks.trackedNotFound.mockClear()
  })

  it('preserves tracked 404 behavior for an unknown on-demand slug', async () => {
    mocks.getEventBySlug.mockResolvedValue(null)

    await expect(
      EventDetailPage({ params: Promise.resolve({ slug: 'missing' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.trackedNotFound).toHaveBeenCalledWith('events', 'missing')
  })
})
