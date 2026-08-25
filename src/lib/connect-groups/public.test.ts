import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({ unstable_cache: mocks.unstableCache }))
vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

import { getPublicConnectGroups } from './public'

describe('public Connect Groups', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active populated groups in campus and schedule order', async () => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          id: 2,
          name: 'North evening group',
          publicName: '',
          rockGroupGuid: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',
          campus: { name: 'North', slug: 'north' },
          leaders: [{ name: 'North Leader', email: 'private@example.com', photoId: null }],
          meetingDay: 2,
          meetingTime: '19:00:00',
          scheduleText: 'Tuesday at 7:00 PM',
        },
        {
          id: 1,
          name: 'Central group',
          publicName: 'Epsom',
          rockGroupGuid: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
          campus: { name: 'Central', slug: 'central' },
          leaders: [{ name: 'Central Leader', email: 'private@example.com', photoId: 42 }],
          meetingDay: 3,
          meetingTime: '19:00:00',
          scheduleText: 'Wednesday at 7:00 PM',
        },
      ],
    })

    await expect(getPublicConnectGroups()).resolves.toEqual([
      expect.objectContaining({
        publicName: 'Epsom',
        rockGroupGuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        leaders: [{
          name: 'Central Leader',
          avatarUrl: 'https://home.ev.church/GetAvatar.ashx?PhotoId=42&Size=96',
        }],
      }),
      expect.objectContaining({
        publicName: 'North evening group',
        rockGroupGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        leaders: [{ name: 'North Leader', avatarUrl: null }],
      }),
    ])
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'connect-groups',
      where: { isActive: { equals: true } },
    }))
  })
})
