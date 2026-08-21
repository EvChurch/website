import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rockFetch: vi.fn(),
  startRockForm: vi.fn(),
  submitRockForm: vi.fn(),
  verifyContext: vi.fn(),
}))

vi.mock('@/lib/rock-api', () => ({ rockFetch: mocks.rockFetch }))
vi.mock('@/lib/rock-forms/server', () => ({
  startRockForm: mocks.startRockForm,
  submitRockForm: mocks.submitRockForm,
}))
vi.mock('@/lib/rock-forms/context-token', () => ({
  verifyRockFormContextToken: mocks.verifyContext,
}))

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
      endpoint: 'GroupMembers/11',
      method: 'PATCH',
      body: expect.objectContaining({ GroupMemberStatus: 1 }),
    }))
    expect(mocks.startRockForm).not.toHaveBeenCalled()
  })

  it('does not write for an existing active subscriber', async () => {
    mocks.rockFetch.mockResolvedValueOnce([active])

    await expect(subscribeDailyReadingEmail(42)).resolves.toEqual({
      alreadySubscribed: true,
    })
    expect(mocks.rockFetch).toHaveBeenCalledTimes(1)
    expect(mocks.startRockForm).not.toHaveBeenCalled()
  })

  it('runs the existing no-input workflow for a new subscriber', async () => {
    const context = {
      personId: 42,
      hidePersonEntryWhenKnown: true,
      initialFieldValues: {},
      knownPersonEntryValues: { person: {} },
    }
    mocks.rockFetch
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ Guid: 'PERSON-GUID' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ Guid: 'PERSON-GUID' })
      .mockResolvedValueOnce([{ Id: 99 }])
    mocks.startRockForm.mockResolvedValue({
      contextToken: 'token',
      personEntry: null,
      fields: [],
      buttons: [{ title: 'Submit' }],
    })
    mocks.verifyContext.mockReturnValue(context)
    mocks.submitRockForm.mockResolvedValue({ action: { actionData: null } })

    await expect(subscribeDailyReadingEmail(42)).resolves.toEqual({ alreadySubscribed: false })
    expect(mocks.submitRockForm).toHaveBeenCalledWith({
      context,
      fieldValues: {},
      personEntryValues: { person: {} },
      button: 'Submit',
    })
  })
})
