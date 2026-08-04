import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { isRockConnectionSignupPublished } from './published'

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(),
}))

const blockGuid = '70f9eb00-5961-42bc-b1ea-dbcb8fce6369'
const find = vi.fn()

describe('published Rock connection signups', () => {
  beforeEach(() => {
    vi.mocked(getPayloadClient).mockResolvedValue({ find } as never)
    find.mockReset()
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
})
