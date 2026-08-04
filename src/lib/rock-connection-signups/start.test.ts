import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RockConnectionSignupSchema } from './types'

const initialize = vi.hoisted(() => vi.fn())
vi.mock('./server', () => ({
  initializeRockConnectionSignup: initialize,
}))

import { verifyRockConnectionContextToken } from './context-token'
import {
  createMemoryNonceStore,
  digestConnectionNonce,
} from './nonce-store'
import { startRockConnectionSignup } from './start'

const blockGuid = '70f9eb00-5961-42bc-b1ea-dbcb8fce6369'
const pageGuid = 'eab9cb2b-474f-4939-b665-e32b4d2e1bb2'
const opportunityGuid = '11111111-1111-4111-8111-111111111111'

function schema(): RockConnectionSignupSchema {
  return {
    pageGuid,
    blockGuid,
    blockTypeGuid: '35d5ef65-0b0d-4e99-82b5-3f5fc2e0344f',
    opportunityGuid,
    opportunityName: 'Newish Connect',
    sessionGuid: '22222222-2222-4222-8222-222222222222',
    interactionGuid: '33333333-3333-4333-8333-333333333333',
    attributes: [],
    campuses: [{ value: '3', text: 'Central' }],
    commentFieldLabel: 'Comments',
    disableCaptchaSupport: true,
    displayHomePhone: true,
    displayMobilePhone: true,
    selectedCampusId: 3,
    firstName: '',
    lastName: '',
    email: '',
    homePhone: null,
    mobilePhone: null,
  }
}

describe('startRockConnectionSignup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initialize.mockResolvedValue(schema())
  })

  it('signs matching claims, persists a consumable nonce, and redacts session IDs', async () => {
    const now = Date.now()
    const nonceStore = createMemoryNonceStore(() => new Date(now))
    const result = await startRockConnectionSignup({
      blockGuid,
      nonceStore,
      now,
    })
    const context = verifyRockConnectionContextToken(result.contextToken, now)

    expect(result.schema).not.toHaveProperty('sessionGuid')
    expect(result.schema).not.toHaveProperty('interactionGuid')
    expect(context).toMatchObject({
      pageGuid,
      blockGuid,
      opportunityGuid,
      sessionGuid: '22222222-2222-4222-8222-222222222222',
      interactionGuid: '33333333-3333-4333-8333-333333333333',
      campuses: ['3'],
      selectedCampusId: 3,
    })
    await expect(
      nonceStore.consume({
        nonceDigest: digestConnectionNonce(context.nonce),
        purpose: context.purpose,
        pageGuid: context.pageGuid,
        blockGuid: context.blockGuid,
        expiresAt: new Date(context.expiresAt),
      }),
    ).resolves.toBe(true)
  })
})
