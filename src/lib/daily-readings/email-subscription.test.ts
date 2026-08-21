import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rockFetch: vi.fn(),
}))

vi.mock('@/lib/rock-api', () => ({ rockFetch: mocks.rockFetch }))

import { isDailyReadingEmailSubscribed, subscribeDailyReadingEmail } from './email-subscription'

const active = { Id: 10, GroupMemberStatus: 1, IsArchived: false }
const inactive = { Id: 11, GroupMemberStatus: 0, IsArchived: false }

describe('Daily Bible Reading email subscription', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid Rock person identifiers before making requests', async () => {
    await expect(subscribeDailyReadingEmail(0)).rejects.toThrow(
      'requires a valid Rock person',
    )
    expect(mocks.rockFetch).not.toHaveBeenCalled()
  })

  it('uses active list membership as the authoritative subscribed state', async () => {
    mocks.rockFetch.mockResolvedValueOnce([active])
    await expect(isDailyReadingEmailSubscribed(42)).resolves.toBe(true)
    expect(mocks.rockFetch).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'GroupMembers',
      retries: 0,
      timeoutMs: 3_000,
    }))
  })

  it('does not treat an unsubscribed member with a retained tag as subscribed', async () => {
    mocks.rockFetch.mockResolvedValueOnce([inactive])
    await expect(isDailyReadingEmailSubscribed(42)).resolves.toBe(false)
    expect(mocks.rockFetch).toHaveBeenCalledTimes(1)
  })

  it('treats a new signup tag as subscribed while list sync is pending', async () => {
    mocks.rockFetch
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ Guid: 'PERSON-GUID' })
      .mockResolvedValueOnce([{ Id: 99 }])
    await expect(isDailyReadingEmailSubscribed(42)).resolves.toBe(true)
    expect(mocks.rockFetch).toHaveBeenNthCalledWith(2, expect.objectContaining({
      endpoint: 'People/42',
      retries: 0,
      timeoutMs: 3_000,
    }))
    expect(mocks.rockFetch).toHaveBeenNthCalledWith(3, expect.objectContaining({
      endpoint: 'TaggedItems',
      retries: 0,
      timeoutMs: 3_000,
    }))
  })

  it('reactivates an inactive communication-list membership', async () => {
    mocks.rockFetch
      .mockResolvedValueOnce([inactive])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([active])
    await expect(subscribeDailyReadingEmail(42)).resolves.toEqual({ alreadySubscribed: false })
    expect(mocks.rockFetch).toHaveBeenNthCalledWith(2, expect.objectContaining({
      endpoint: expect.stringContaining('/UpdateSubscription'),
      method: 'POST',
      body: {
        __context: { pageParameters: { PersonId: '42' } },
        bag: {
          communicationListGuid: '9163f4c1-90b4-4bd3-a9e1-1a7cf201a86b',
          isSubscribed: true,
        },
      },
    }))
  })

  it('does not write for an existing active subscriber', async () => {
    mocks.rockFetch.mockResolvedValueOnce([active])

    await expect(subscribeDailyReadingEmail(42)).resolves.toEqual({
      alreadySubscribed: true,
    })
    expect(mocks.rockFetch).toHaveBeenCalledTimes(1)
  })

  it('uses Rock’s communication-list subscribe action for a new subscriber', async () => {
    mocks.rockFetch
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([active])

    await expect(subscribeDailyReadingEmail(42)).resolves.toEqual({ alreadySubscribed: false })
    expect(mocks.rockFetch).toHaveBeenNthCalledWith(2, expect.objectContaining({
      endpoint: expect.stringContaining('/UpdateSubscription'),
    }))
  })

  it('does not report success until Rock returns an active membership', async () => {
    mocks.rockFetch
      .mockResolvedValueOnce([inactive])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([inactive])

    await expect(subscribeDailyReadingEmail(42)).rejects.toThrow(
      'membership was not activated',
    )
  })
})
