import { beforeEach, describe, expect, it, vi } from 'vitest'

const find = vi.fn()
vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find })),
}))

import { isActiveConnectGroupGuid } from './server'

describe('isActiveConnectGroupGuid', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires an active mirrored Connect Group', async () => {
    find.mockResolvedValue({ docs: [{ rockGroupId: 29038 }] })
    await expect(
      isActiveConnectGroupGuid('9756A8FD-A865-4070-ADD3-03B3396C4B9A'),
    ).resolves.toBe(true)
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        and: [
          { rockGroupGuid: { equals: '9756a8fd-a865-4070-add3-03b3396c4b9a' } },
          { isActive: { equals: true } },
        ],
      },
    }))
  })

  it('rejects malformed identifiers before Payload access', async () => {
    await expect(isActiveConnectGroupGuid('not-a-guid')).resolves.toBe(false)
    expect(find).not.toHaveBeenCalled()
  })
})
