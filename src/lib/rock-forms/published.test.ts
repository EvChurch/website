import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { isPublishedLauncherWorkflow } from '@/lib/launcher/service-guide'
import {
  CONNECT_CARD_WORKFLOW_GUID,
  PLAN_A_VISIT_WORKFLOW_GUID,
} from '@/lib/launcher/constants'
import { isRockFormPublished } from './published'

vi.mock('@/lib/payload', () => ({ getPayloadClient: vi.fn() }))
vi.mock('@/lib/launcher/service-guide', () => ({
  isPublishedLauncherWorkflow: vi.fn(),
}))

const find = vi.fn()

describe('published Rock workflows', () => {
  beforeEach(() => {
    find.mockReset()
    vi.mocked(getPayloadClient).mockResolvedValue({ find } as never)
    vi.mocked(isPublishedLauncherWorkflow).mockReset()
    vi.mocked(isPublishedLauncherWorkflow).mockResolvedValue(false)
  })

  it.each([PLAN_A_VISIT_WORKFLOW_GUID, CONNECT_CARD_WORKFLOW_GUID])(
    'explicitly publishes the fixed launcher workflow %s',
    async (guid) => {
      await expect(isRockFormPublished(guid)).resolves.toBe(true)
      expect(getPayloadClient).not.toHaveBeenCalled()
    },
  )

  it('accepts published page workflows before checking launcher records', async () => {
    find.mockResolvedValue({ docs: [{ slug: 'visit' }] })
    const guid = '11111111-1111-1111-1111-111111111111'
    await expect(isRockFormPublished(guid)).resolves.toBe(true)
    expect(isPublishedLauncherWorkflow).not.toHaveBeenCalled()
  })

  it('uses the eligible launcher allowlist and denies arbitrary identifiers', async () => {
    find.mockResolvedValue({ docs: [] })
    vi.mocked(isPublishedLauncherWorkflow).mockResolvedValueOnce(true)
    const guid = '11111111-1111-1111-1111-111111111111'
    await expect(isRockFormPublished(guid)).resolves.toBe(true)
    await expect(isRockFormPublished('not-a-guid')).resolves.toBe(false)
  })
})
