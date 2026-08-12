import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  isPublished: vi.fn(),
  verifyContext: vi.fn(),
  verifyTurnstile: vi.fn(),
  getSiteKey: vi.fn(),
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
  getTurnstileSiteKey: mocks.getSiteKey,
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

function postRequest(
  body: FormData,
  origin = 'http://localhost',
  url = `http://localhost/api/rock-forms/${workflowTypeGuid}`,
) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { origin },
    body,
  })
}

describe('Rock form route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isPublished.mockResolvedValue(true)
    mocks.getSiteKey.mockReturnValue('test-site-key')
    process.env.ROCK_WORKFLOW_REDIRECT_ORIGINS = 'https://www.ev.church'
  })

  afterEach(() => {
    delete process.env.ROCK_WORKFLOW_REDIRECT_ORIGINS
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
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

  it('uses the Railway public hostname for Turnstile behind the production proxy', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'new.ev.church')
    const body = new FormData()
    body.set('intent', 'start')
    body.set('turnstileToken', 'verified-token')
    mocks.startForm.mockResolvedValue({ workflowName: 'Contact Us' })

    const response = await POST(
      postRequest(
        body,
        'https://new.ev.church',
        `https://0.0.0.0:3000/api/rock-forms/${workflowTypeGuid}`,
      ),
      routeContext,
    )

    expect(response.status).toBe(200)
    expect(mocks.verifyTurnstile).toHaveBeenCalledWith(
      expect.objectContaining({ expectedHostname: 'new.ev.church' }),
    )
  })

  it.each([
    [
      'publication lookup',
      () =>
        mocks.isPublished.mockRejectedValueOnce(
          new Error('database unavailable'),
        ),
    ],
    [
      'Turnstile configuration',
      () =>
        mocks.getSiteKey.mockImplementationOnce(() => {
          throw new Error('missing site key')
        }),
    ],
  ])('returns a JSON 502 when %s fails', async (_name, arrange) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    arrange()

    const response = await GET(
      new NextRequest(`http://localhost/api/rock-forms/${workflowTypeGuid}`),
      routeContext,
    )

    expect(response.status).toBe(502)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({
      error: 'Unable to load this form right now',
    })
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
          message: { type: 4, content: 'https://www.ev.church/thanks' },
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
      message: 'https://www.ev.church/thanks',
      redirectUrl: 'https://www.ev.church/thanks',
    })
  })

  it('does not redirect to Rock workflow-entry permalinks after completion', async () => {
    mocks.verifyContext.mockReturnValue({
      workflowTypeGuid,
      initialFieldValues: {},
      allowedFields: [],
      buttonTitles: ['Submit'],
    })
    mocks.submitForm.mockResolvedValue({
      workflow: { guid: workflowTypeGuid, name: 'Contact Us' },
      action: {
        url: `/page/1108?WorkflowTypeGuid=${workflowTypeGuid}&WorkflowId=32764`,
      },
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
      message: 'Thanks. Your form has been submitted.',
      redirectUrl: null,
    })
    expect(mocks.submitForm).toHaveBeenCalledOnce()
  })

  it('normalizes explicit relative Redirect actions against the verified request origin', async () => {
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
          message: { type: 'Redirect', content: '/thanks?source=workflow' },
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
    expect(await response.json()).toMatchObject({
      status: 'complete',
      redirectUrl: 'http://localhost/thanks?source=workflow',
    })
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

  it('rejects oversized multipart requests before parsing or verification', async () => {
    const response = await POST(
      new NextRequest(
        `http://localhost/api/rock-forms/${workflowTypeGuid}`,
        {
          method: 'POST',
          headers: {
            origin: 'http://localhost',
            'content-type': 'multipart/form-data; boundary=test',
            'content-length': String(18 * 1024 * 1024),
          },
          body: '--test--',
        },
      ),
      routeContext,
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Form submission is too large',
    })
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled()
  })
})
