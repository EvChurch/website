import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { isPublishedLauncherConnection } from '@/lib/launcher/service-guide'
import { isRockConnectionSignupPublished } from './published'

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(),
}))
vi.mock('@/lib/launcher/service-guide', () => ({
  isPublishedLauncherConnection: vi.fn(),
}))

const blockGuid = '70f9eb00-5961-42bc-b1ea-dbcb8fce6369'
const find = vi.fn()

describe('published Rock connection signups', () => {
  beforeEach(() => {
    vi.mocked(getPayloadClient).mockResolvedValue({ find } as never)
    find.mockReset()
    vi.mocked(isPublishedLauncherConnection).mockReset()
    vi.mocked(isPublishedLauncherConnection).mockResolvedValue(false)
  })

  it('uses one layout relation filter and validates the matching block after loading', async () => {
    find.mockResolvedValue({
      docs: [
        {
          layout: [
            {
              blockType: 'formEmbed',
              sourceType: 'connectionOpportunity',
              rockConnectionBlockGuid: blockGuid,
            },
          ],
        },
      ],
    })

    await expect(isRockConnectionSignupPublished(blockGuid)).resolves.toBe(true)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { layout: true },
        where: {
          and: [
            { _status: { equals: 'published' } },
            { 'layout.rockConnectionBlockGuid': { equals: blockGuid } },
          ],
        },
      }),
    )
  })

  it('rejects a GUID found on a workflow or non-form block', async () => {
    find.mockResolvedValue({
      docs: [
        {
          layout: [
            {
              blockType: 'formEmbed',
              sourceType: 'workflow',
              rockConnectionBlockGuid: blockGuid,
            },
            {
              blockType: 'content',
              sourceType: 'connectionOpportunity',
              rockConnectionBlockGuid: blockGuid,
            },
          ],
        },
      ],
    })

    await expect(isRockConnectionSignupPublished(blockGuid)).resolves.toBe(
      false,
    )
  })

  it('checks every matching page instead of stopping at an invalid legacy row', async () => {
    find.mockResolvedValue({
      docs: [
        {
          layout: [
            {
              blockType: 'formEmbed',
              sourceType: 'workflow',
              rockConnectionBlockGuid: blockGuid,
            },
          ],
        },
        {
          layout: [
            {
              blockType: 'formEmbed',
              sourceType: 'connectionOpportunity',
              rockConnectionBlockGuid: blockGuid,
            },
          ],
        },
      ],
    })

    await expect(isRockConnectionSignupPublished(blockGuid)).resolves.toBe(true)
  })

  it('accepts an eligible launcher action and denies a shadowed or arbitrary block', async () => {
    find.mockResolvedValue({ docs: [] })
    vi.mocked(isPublishedLauncherConnection).mockResolvedValueOnce(true)

    await expect(isRockConnectionSignupPublished(blockGuid)).resolves.toBe(true)
    expect(isPublishedLauncherConnection).toHaveBeenCalledWith(blockGuid)

    await expect(
      isRockConnectionSignupPublished('not-a-guid'),
    ).resolves.toBe(false)
  })
})
