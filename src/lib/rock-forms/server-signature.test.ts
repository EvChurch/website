import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rockFetch: vi.fn(),
  contextToken: vi.fn(() => 'signed-signature-context'),
}))

vi.mock('@/lib/rock-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rock-api')>(
    '@/lib/rock-api',
  )
  return { ...actual, rockFetch: mocks.rockFetch }
})
vi.mock('./context-token', () => ({
  createRockFormContextToken: mocks.contextToken,
}))
vi.mock('./config', () => ({
  getTurnstileSiteKey: () => 'test-key',
  ROCK_FORM_CONTEXT_TTL_SECONDS: 7200,
  ROCK_FORM_PAGE_GUID: 'standard-page',
  ROCK_FORM_BLOCK_GUID: 'standard-block',
  ROCK_SIGNATURE_PAGE_GUID: 'signature-page',
  ROCK_SIGNATURE_BLOCK_GUID: 'signature-block',
}))

import {
  buildRockFormSchema,
  resumeRockSignatureAction,
  submitRockForm,
} from './server'
import {
  MEMBERSHIP_WORKFLOW_TYPE_GUID,
  ROCK_SIGNATURE_COMPONENT_URL,
} from './constants'
import type { RockFormContext, RockInteractiveAction } from './types'

const workflowGuid = '6fb3a6dc-03fc-4b11-9db4-6f64e0544424'
const workflowTypeGuid = MEMBERSHIP_WORKFLOW_TYPE_GUID
const signatureAction: RockInteractiveAction = {
  workflowGuid,
  actionTypeGuid: 'signature-action',
  actionStartDateTime: '2026-10-17T00:00:00+13:00',
  actionData: {
    componentUrl: ROCK_SIGNATURE_COMPONENT_URL,
    componentConfiguration: {
      signatureType: '1',
      content: '<p>Existing membership document</p>',
      documentTerm: 'Application',
      sendCopy: 'True',
      legalName: 'Test Applicant',
      signedByEmail: 'test@example.test',
    },
  },
}

describe('Rock signature workflow continuity', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    process.env.ROCK_API_URL = 'https://rock.example.test/api'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.ROCK_API_URL
  })

  it('binds the signature step to the same workflow action', async () => {
    const form = await buildRockFormSchema({
      workflow: { guid: workflowTypeGuid, name: 'Membership Application' },
      action: signatureAction,
      sessionGuid: 'session',
      interactionGuid: 'interaction',
    })

    expect(form.signature).toMatchObject({
      type: 'drawn',
      documentHtml: '<p>Existing membership document</p>',
      legalName: 'Test Applicant',
      email: 'test@example.test',
    })
    expect(mocks.contextToken).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowGuid,
        actionTypeGuid: 'signature-action',
        signatureType: 'drawn',
        allowedFields: [],
      }),
    )
  })

  it('reloads the signature under the anonymous applicant context', async () => {
    fetchMock.mockResolvedValue(Response.json(signatureAction))

    await expect(
      resumeRockSignatureAction({
        workflowTypeGuid,
        workflowGuid,
        sessionGuid: 'session',
        interactionGuid: 'interaction',
      }),
    ).resolves.toEqual(signatureAction)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://rock.example.test/api/v2/BlockActions/signature-page/signature-block/GetNextInteractiveAction',
    )
    expect(init.headers).not.toHaveProperty('Authorization-Token')
    expect(JSON.parse(init.body)).toMatchObject({
      workflowGuid,
      actionTypeGuid: null,
      componentData: null,
    })
  })

  it('refuses to use the membership-only transport for another workflow', async () => {
    await expect(
      resumeRockSignatureAction({
        workflowTypeGuid: '874418b5-a477-4382-94dc-38060b005bfa',
        workflowGuid,
        sessionGuid: 'session',
        interactionGuid: 'interaction',
      }),
    ).rejects.toThrow('Electronic signatures are not enabled for this form')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits the signature without the service-account identity', async () => {
    mocks.rockFetch.mockResolvedValueOnce([
      {
        Guid: workflowTypeGuid,
        Name: 'Membership Application',
        FormBuilderTemplateId: 42,
      },
    ])
    fetchMock.mockResolvedValue(
      Response.json({
        workflowGuid,
        actionData: {
          message: { type: 2, content: 'Signature accepted' },
        },
      }),
    )
    const context = {
      version: 1,
      workflowTypeGuid,
      workflowGuid,
      sessionGuid: 'session',
      interactionGuid: 'interaction',
      actionTypeGuid: 'signature-action',
      actionStartDateTime: signatureAction.actionStartDateTime,
      signatureType: 'drawn',
      initialFieldValues: {},
      allowedFields: [],
      buttonTitles: ['Complete'],
      expiresAt: Date.now() + 60_000,
    } as RockFormContext
    const signature = {
      signatureData: 'data:image/png;base64,fixture',
      signedByName: 'Test Applicant',
      signedByEmail: 'test@example.test',
    }

    await submitRockForm({
      context,
      signature,
      fieldValues: {},
      personEntryValues: null,
      button: 'Complete',
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers).not.toHaveProperty('Authorization-Token')
    expect(JSON.parse(init.body)).toMatchObject({
      workflowGuid,
      actionTypeGuid: 'signature-action',
      componentData: signature,
    })
  })
})
