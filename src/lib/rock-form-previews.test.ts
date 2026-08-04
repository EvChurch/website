import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  startRockForm: vi.fn(),
  initializeConnection: vi.fn(),
}))

vi.mock('next/cache', () => ({
  unstable_cache: (loader: unknown) => loader,
}))
vi.mock('./rock-forms/server', () => ({
  startRockForm: mocks.startRockForm,
}))
vi.mock('./rock-connection-signups/server', () => ({
  initializeRockConnectionSignup: mocks.initializeConnection,
}))

import {
  getRockConnectionSignupPreview,
  getRockFormPreview,
} from './rock-form-previews'

describe('Rock form server previews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('removes workflow submission context and field capability tokens', async () => {
    mocks.startRockForm.mockResolvedValue({
      workflowTypeGuid: 'workflow-guid',
      contextToken: 'signed-context',
      fields: [
        {
          securityGrantToken: 'field-token',
          attribute: { securityGrantToken: 'attribute-token' },
        },
      ],
    })

    await expect(getRockFormPreview('workflow-guid')).resolves.toMatchObject({
      contextToken: '',
      fields: [
        {
          securityGrantToken: null,
          attribute: { securityGrantToken: null },
        },
      ],
    })
  })

  it('removes connection session identifiers without creating a nonce', async () => {
    mocks.initializeConnection.mockResolvedValue({
      pageGuid: 'page-guid',
      blockGuid: 'block-guid',
      sessionGuid: 'session-guid',
      interactionGuid: 'interaction-guid',
      opportunityName: 'Newish Connect',
    })

    const preview = await getRockConnectionSignupPreview('block-guid')

    expect(preview).toMatchObject({ opportunityName: 'Newish Connect' })
    expect(preview).not.toHaveProperty('sessionGuid')
    expect(preview).not.toHaveProperty('interactionGuid')
  })
})
