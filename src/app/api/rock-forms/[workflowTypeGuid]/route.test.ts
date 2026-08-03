import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  isPublished: vi.fn(),
  verifyContext: vi.fn(),
  verifyTurnstile: vi.fn(),
  startForm: vi.fn(),
  submitForm: vi.fn(),
}))

vi.mock('@/lib/rock-forms/published', () => ({
  isRockFormPublished: mocks.isPublished,
}))

vi.mock('@/lib/rock-forms/context-token', () => ({
  verifyRockFormContextToken: mocks.verifyContext,
}))

vi.mock('@/lib/rock-forms/config', () => ({
  getTurnstileSiteKey: () => 'test-site-key',
}))

vi.mock('@/lib/rock-forms/server', () => ({
  buildRockFormSchema: vi.fn(),
  startRockForm: mocks.startForm,
  submitRockForm: mocks.submitForm,
  uploadRockFormFile: vi.fn(),
  verifyTurnstileToken: mocks.verifyTurnstile,
}))

import { GET, POST } from './route'

const workflowTypeGuid = '874418b5-a477-4382-94dc-38060b005bfa'
const routeContext = { params: Promise.resolve({ workflowTypeGuid }) }

function postRequest(body: FormData, origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/rock-forms/${workflowTypeGuid}`, {
    method: 'POST',
    headers: { origin },
    body,
  })
}

describe('Rock form route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isPublished.mockResolvedValue(true)
    process.env.ROCK_WORKFLOW_REDIRECT_ORIGINS = 'https://ev.church'
  })

  afterEach(() => {
    delete process.env.ROCK_WORKFLOW_REDIRECT_ORIGINS
  })

  it('does not start a Rock workflow until Turnstile is verified', async () => {
    const getResponse = await GET(
      new NextRequest(`http://localhost/api/rock-forms/${workflowTypeGuid}`),
      routeContext,
    )
    expect(await getResponse.json()).toEqual({ turnstileSiteKey: 'test-site-key' })
    expect(mocks.startForm).not.toHaveBeenCalled()

    const body = new FormData()
    body.set('intent', 'start')
    body.set('turnstileToken', 'verified-token')
    mocks.startForm.mockResolvedValue({ workflowName: 'Contact Us' })

    const response = await POST(postRequest(body), routeContext)
    expect(response.status).toBe(200)
    expect(mocks.verifyTurnstile).toHaveBeenCalledOnce()
    expect(mocks.startForm).toHaveBeenCalledWith(workflowTypeGuid)
  })

  it('returns Rock completion message content and redirect targets', async () => {
    const context = {
      workflowTypeGuid,
      initialFieldValues: {},
      allowedFields: [],
      buttonTitles: ['Submit'],
    }
    mocks.verifyContext.mockReturnValue(context)
    mocks.submitForm.mockResolvedValue({
      workflow: { guid: workflowTypeGuid, name: 'Contact Us' },
      action: {
        actionData: {
          message: { type: 4, content: 'https://ev.church/thanks' },
        },
      },
    })

    const body = new FormData()
    body.set('contextToken', 'signed-context')
    body.set('turnstileToken', 'verified-token')
    body.set('fieldValues', '{}')
    body.set('personEntryValues', 'null')
    body.set('button', 'Submit')

    const response = await POST(postRequest(body), routeContext)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'complete',
      message: 'https://ev.church/thanks',
      redirectUrl: 'https://ev.church/thanks',
    })
  })

  it('normalizes relative Workflow redirects against the verified request origin', async () => {
    mocks.verifyContext.mockReturnValue({
      workflowTypeGuid,
      initialFieldValues: {},
      allowedFields: [],
      buttonTitles: ['Submit'],
    })
    mocks.submitForm.mockResolvedValue({
      workflow: { guid: workflowTypeGuid, name: 'Contact Us' },
      action: { url: '/thanks?source=workflow' },
    })
    const body = new FormData()
    body.set('contextToken', 'signed-context')
    body.set('turnstileToken', 'verified-token')
    body.set('fieldValues', '{}')
    body.set('personEntryValues', 'null')
    body.set('button', 'Submit')

    const response = await POST(postRequest(body), routeContext)
    expect(await response.json()).toMatchObject({
      status: 'complete',
      redirectUrl: 'http://localhost/thanks?source=workflow',
    })
    expect(mocks.submitForm).toHaveBeenCalledOnce()
  })

  it('removes an unsafe Workflow redirect after submission', async () => {
    mocks.verifyContext.mockReturnValue({
      workflowTypeGuid,
      initialFieldValues: {},
      allowedFields: [],
      buttonTitles: ['Submit'],
    })
    mocks.submitForm.mockResolvedValue({
      workflow: { guid: workflowTypeGuid, name: 'Contact Us' },
      action: {
        actionData: {
          message: {
            type: 'Redirect',
            content: 'javascript:alert(document.cookie)',
          },
        },
      },
    })
    const body = new FormData()
    body.set('contextToken', 'signed-context')
    body.set('turnstileToken', 'verified-token')
    body.set('fieldValues', '{}')
    body.set('personEntryValues', 'null')
    body.set('button', 'Submit')

    const response = await POST(postRequest(body), routeContext)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'complete',
      message: 'Thanks. Your form has been submitted.',
      redirectUrl: null,
    })
  })

  it('rejects cross-origin submissions before external verification', async () => {
    const body = new FormData()
    body.set('intent', 'start')
    body.set('turnstileToken', 'token')

    const response = await POST(
      postRequest(body, 'https://attacker.example'),
      routeContext,
    )
    expect(response.status).toBe(403)
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled()
  })
})
