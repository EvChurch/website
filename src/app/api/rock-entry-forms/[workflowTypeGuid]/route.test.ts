import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  isPublished: vi.fn(),
  verifyContext: vi.fn(),
  verifyTurnstile: vi.fn(),
  getSiteKey: vi.fn(),
  startForm: vi.fn(),
  submitForm: vi.fn(),
  resumeSignature: vi.fn(),
  getSession: vi.fn(),
  getProfileState: vi.fn(),
  isPublicConnectGroupGuid: vi.fn(),
}))

vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({ getSession: mocks.getSession }),
}))

vi.mock('@/auth/member-session', () => ({
  getMemberProfileStateFromSession: mocks.getProfileState,
}))

vi.mock('@/lib/rock-forms/published', () => ({
  isRockFormPublished: mocks.isPublished,
}))

vi.mock('@/lib/rock-forms/context-token', () => ({
  verifyRockFormContextToken: mocks.verifyContext,
}))

vi.mock('@/lib/connect-groups/server', () => ({
  isPublicConnectGroupGuid: mocks.isPublicConnectGroupGuid,
}))

vi.mock('@/lib/rock-forms/config', () => ({
  getTurnstileSiteKey: mocks.getSiteKey,
  getTurnstileSecretKey: () => 'production-secret-fixture',
  TURNSTILE_TEST_SECRET_KEY: '1x0000000000000000000000000000000AA',
}))

vi.mock('@/lib/rock-forms/server', () => ({
  buildRockFormSchema: vi.fn(),
  resumeRockSignatureAction: mocks.resumeSignature,
  startRockForm: mocks.startForm,
  submitRockForm: mocks.submitForm,
  uploadRockFormFile: vi.fn(),
  verifyTurnstileToken: mocks.verifyTurnstile,
}))

import { GET, POST } from './route'
import { CONNECT_GROUP_WORKFLOW_GUID, CONNECT_GROUP_FIELD_GUID } from '@/lib/connect-groups/constants'
import { buildRockFormSchema } from '@/lib/rock-forms/server'
import {
  MEMBERSHIP_WORKFLOW_TYPE_GUID,
  ROCK_SIGNATURE_COMPONENT_URL,
} from '@/lib/rock-forms/constants'

const workflowTypeGuid = '874418b5-a477-4382-94dc-38060b005bfa'
const routeContext = { params: Promise.resolve({ workflowTypeGuid }) }
const membershipRouteContext = {
  params: Promise.resolve({ workflowTypeGuid: MEMBERSHIP_WORKFLOW_TYPE_GUID }),
}

function postRequest(
  body: FormData,
  origin = 'http://localhost',
  url = `http://localhost/api/rock-entry-forms/${workflowTypeGuid}`,
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
    mocks.getSession.mockResolvedValue(null)
    mocks.getProfileState.mockReturnValue(null)
    mocks.isPublicConnectGroupGuid.mockResolvedValue(true)
    process.env.ROCK_WORKFLOW_REDIRECT_ORIGINS = 'https://www.ev.church'
  })

  afterEach(() => {
    delete process.env.ROCK_WORKFLOW_REDIRECT_ORIGINS
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('continues through the anonymous applicant signature step', async () => {
    const formContext = {
      workflowTypeGuid: MEMBERSHIP_WORKFLOW_TYPE_GUID,
      workflowGuid: '6fb3a6dc-03fc-4b11-9db4-6f64e0544424',
      sessionGuid: 'session',
      interactionGuid: 'interaction',
      initialFieldValues: {},
      allowedFields: [],
      buttonTitles: ['Submit'],
    }
    mocks.verifyContext.mockReturnValue(formContext)
    const authenticatedAction = {
      workflowGuid: formContext.workflowGuid,
      actionData: { componentUrl: ROCK_SIGNATURE_COMPONENT_URL },
    }
    const anonymousAction = {
      ...authenticatedAction,
      actionTypeGuid: 'signature-action',
      actionStartDateTime: '2026-10-17T00:00:00+13:00',
      actionData: {
        componentUrl: ROCK_SIGNATURE_COMPONENT_URL,
        componentConfiguration: {
          signatureType: '1',
          content: '<p>Membership declaration</p>',
        },
      },
    }
    mocks.submitForm.mockResolvedValue({
      workflow: { guid: MEMBERSHIP_WORKFLOW_TYPE_GUID, name: 'Membership' },
      action: authenticatedAction,
    })
    mocks.resumeSignature.mockResolvedValue(anonymousAction)
    const form = {
      signature: { type: 'drawn' },
      contextToken: 'next-signature-context',
    }
    vi.mocked(buildRockFormSchema).mockResolvedValue(form as never)
    const body = new FormData()
    body.set('contextToken', 'signed-context')
    body.set('turnstileToken', 'verified-token')
    body.set('button', 'Submit')

    const response = await POST(
      postRequest(
        body,
        'http://localhost',
        `http://localhost/api/rock-entry-forms/${MEMBERSHIP_WORKFLOW_TYPE_GUID}`,
      ),
      membershipRouteContext,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'next', form })
    expect(mocks.resumeSignature).toHaveBeenCalledWith({
      workflowTypeGuid: MEMBERSHIP_WORKFLOW_TYPE_GUID,
      workflowGuid: formContext.workflowGuid,
      sessionGuid: 'session',
      interactionGuid: 'interaction',
      personId: undefined,
    })
    expect(buildRockFormSchema).toHaveBeenCalledWith(
      expect.objectContaining({ action: anonymousAction }),
    )
  })

  it('rejects incomplete drawn signatures before calling Rock', async () => {
    mocks.verifyContext.mockReturnValue({
      workflowTypeGuid: MEMBERSHIP_WORKFLOW_TYPE_GUID,
      signatureType: 'drawn',
      initialFieldValues: {},
      allowedFields: [],
      buttonTitles: ['Complete'],
    })
    const body = new FormData()
    body.set('contextToken', 'signature-context')
    body.set('turnstileToken', 'verified-token')
    body.set('button', 'Complete')
    body.set('signedByName', 'Test Applicant')
    body.set('signedByEmail', 'test@example.test')

    const response = await POST(
      postRequest(
        body,
        'http://localhost',
        `http://localhost/api/rock-entry-forms/${MEMBERSHIP_WORKFLOW_TYPE_GUID}`,
      ),
      membershipRouteContext,
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Draw your signature.' })
    expect(mocks.submitForm).not.toHaveBeenCalled()
  })

  it.each([
    { actionData: { message: { type: 0, content: 'PDF generation failed' } } },
    { actionData: { exception: 'Unexpected signing exception' } },
    { actionData: {} },
  ])('does not show a Rock signing error as successful completion', async (action) => {
    mocks.verifyContext.mockReturnValue({
      workflowTypeGuid: MEMBERSHIP_WORKFLOW_TYPE_GUID,
      signatureType: 'typed',
      initialFieldValues: {},
      allowedFields: [],
      buttonTitles: ['Complete'],
    })
    mocks.submitForm.mockResolvedValue({
      workflow: { guid: MEMBERSHIP_WORKFLOW_TYPE_GUID, name: 'Membership' },
      action,
    })
    const body = new FormData()
    body.set('contextToken', 'signature-context')
    body.set('turnstileToken', 'verified-token')
    body.set('button', 'Complete')
    body.set('signedByName', 'Test Applicant')
    body.set('signedByEmail', 'test@example.test')

    const response = await POST(
      postRequest(
        body,
        'http://localhost',
        `http://localhost/api/rock-entry-forms/${MEMBERSHIP_WORKFLOW_TYPE_GUID}`,
      ),
      membershipRouteContext,
    )

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error:
        'Rock could not complete the signature. Your application is not complete.',
    })
  })

  it('does not send another workflow through the membership signature block', async () => {
    mocks.verifyContext.mockReturnValue({
      workflowTypeGuid,
      signatureType: 'typed',
      initialFieldValues: {},
      allowedFields: [],
      buttonTitles: ['Complete'],
    })
    const body = new FormData()
    body.set('contextToken', 'signature-context')
    body.set('turnstileToken', 'verified-token')
    body.set('button', 'Complete')
    body.set('signedByName', 'Test Applicant')
    body.set('signedByEmail', 'test@example.test')

    const response = await POST(postRequest(body), routeContext)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Electronic signatures are not enabled for this form',
    })
    expect(mocks.submitForm).not.toHaveBeenCalled()
  })

  it('does not mark an unknown interactive workflow step as complete', async () => {
    mocks.verifyContext.mockReturnValue({
      workflowTypeGuid,
      initialFieldValues: {},
      allowedFields: [],
      buttonTitles: ['Submit'],
    })
    mocks.submitForm.mockResolvedValue({
      workflow: { guid: workflowTypeGuid, name: 'Membership' },
      action: { actionData: { componentUrl: '/unsupported.obs' } },
    })
    const body = new FormData()
    body.set('contextToken', 'signed-context')
    body.set('turnstileToken', 'verified-token')
    body.set('button', 'Submit')

    const response = await POST(postRequest(body), routeContext)

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error:
        'Rock returned an unsupported workflow step. Your application is not complete.',
    })
  })

  it('does not start a Rock workflow until Turnstile is verified', async () => {
    const getResponse = await GET(
      new NextRequest(`http://localhost/api/rock-entry-forms/${workflowTypeGuid}`),
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
    expect(mocks.startForm).toHaveBeenCalledWith(workflowTypeGuid, null, {})
  })

  it('starts a Rock workflow for the authenticated member person', async () => {
    mocks.getSession.mockResolvedValue({ user: { sub: 'auth0|member' } })
    mocks.getProfileState.mockReturnValue({
      profile: { personId: 42 },
      needsRefresh: false,
    })
    mocks.startForm.mockResolvedValue({ workflowName: 'Connect Card' })
    const body = new FormData()
    body.set('intent', 'start')
    body.set('turnstileToken', 'verified-token')

    const response = await POST(postRequest(body), routeContext)

    expect(response.status).toBe(200)
    expect(mocks.startForm).toHaveBeenCalledWith(workflowTypeGuid, 42, {})
  })

  it('passes a validated Connect Group into the existing Rock workflow', async () => {
    const groupGuid = '9756a8fd-a865-4070-add3-03b3396c4b9a'
    const connectContext = {
      params: Promise.resolve({ workflowTypeGuid: CONNECT_GROUP_WORKFLOW_GUID }),
    }
    const body = new FormData()
    body.set('intent', 'start')
    body.set('turnstileToken', 'verified-token')
    body.set('groupGuid', groupGuid.toUpperCase())
    mocks.startForm.mockResolvedValue({ workflowName: 'Join a Connect Group' })

    const response = await POST(
      postRequest(
        body,
        'http://localhost',
        `http://localhost/api/rock-entry-forms/${CONNECT_GROUP_WORKFLOW_GUID}`,
      ),
      connectContext,
    )

    expect(response.status).toBe(200)
    expect(mocks.isPublicConnectGroupGuid).toHaveBeenCalledWith(groupGuid)
    expect(mocks.startForm).toHaveBeenCalledWith(
      CONNECT_GROUP_WORKFLOW_GUID,
      null,
      { GroupGuid: groupGuid },
    )
  })

  it('rejects a Connect Group that is not active in the Rock mirror', async () => {
    const groupGuid = '9756a8fd-a865-4070-add3-03b3396c4b9a'
    mocks.isPublicConnectGroupGuid.mockResolvedValue(false)
    const body = new FormData()
    body.set('intent', 'start')
    body.set('turnstileToken', 'verified-token')
    body.set('groupGuid', groupGuid)

    const response = await POST(
      postRequest(
        body,
        'http://localhost',
        `http://localhost/api/rock-entry-forms/${CONNECT_GROUP_WORKFLOW_GUID}`,
      ),
      { params: Promise.resolve({ workflowTypeGuid: CONNECT_GROUP_WORKFLOW_GUID }) },
    )

    expect(response.status).toBe(400)
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled()
    expect(mocks.startForm).not.toHaveBeenCalled()
  })

  it('uses the Railway public hostname for Turnstile behind the production proxy', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'www.ev.church')
    const body = new FormData()
    body.set('intent', 'start')
    body.set('turnstileToken', 'verified-token')
    mocks.startForm.mockResolvedValue({ workflowName: 'Contact Us' })

    const response = await POST(
      postRequest(
        body,
        'https://www.ev.church',
        `https://0.0.0.0:3000/api/rock-entry-forms/${workflowTypeGuid}`,
      ),
      routeContext,
    )

    expect(response.status).toBe(200)
    expect(mocks.verifyTurnstile).toHaveBeenCalledWith(
      expect.objectContaining({ expectedHostname: 'www.ev.church' }),
    )
  })

  it.each([
    ['www.ev.church', 200],
    ['other.example', 400],
    ['new.ev.church', 400],
  ])('checks the token hostname %s against the configured canonical website', async (hostname, status) => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'new.ev.church')
    vi.stubEnv('APP_BASE_URL', 'https://www.ev.church')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.ev.church')
    const { verifyTurnstileToken } = await import('@/lib/turnstile')
    mocks.verifyTurnstile.mockImplementationOnce(verifyTurnstileToken)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      hostname,
      action: 'rock_form_start',
    })))
    mocks.startForm.mockResolvedValue({ workflowName: 'Reimbursement' })
    const body = new FormData()
    body.set('intent', 'start')
    body.set('turnstileToken', 'verified-token')

    const response = await POST(postRequest(
      body,
      'https://www.ev.church',
      `http://0.0.0.0:3000/api/rock-entry-forms/${workflowTypeGuid}`,
    ), routeContext)

    const result = await response.json()
    expect(result).toEqual(status === 200
      ? { workflowName: 'Reimbursement' }
      : { error: 'The bot check was issued for a different website' })
    expect(response.status).toBe(status)
    expect(mocks.startForm).toHaveBeenCalledTimes(status === 200 ? 1 : 0)
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
      new NextRequest(`http://localhost/api/rock-entry-forms/${workflowTypeGuid}`),
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

  it.each(['https://attacker.example', 'https://www.ev.church.attacker.example', 'http://www.ev.church', 'https://www.ev.church:444', ''])('rejects unapproved production origin %s before token verification', async (origin) => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'new.ev.church')
    vi.stubEnv('APP_BASE_URL', 'https://www.ev.church')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.ev.church')
    const body = new FormData()
    body.set('intent', 'start')
    body.set('turnstileToken', 'verified-token')

    const response = await POST(postRequest(
      body,
      origin,
      `http://0.0.0.0:3000/api/rock-entry-forms/${workflowTypeGuid}`,
    ), routeContext)

    expect(response.status).toBe(403)
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled()
    expect(mocks.startForm).not.toHaveBeenCalled()
  })

  it('rejects oversized multipart requests before parsing or verification', async () => {
    const response = await POST(
      new NextRequest(
        `http://localhost/api/rock-entry-forms/${workflowTypeGuid}`,
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


describe('Connect Group signup privacy', () => {
  const groupGuid = '9756a8fd-a865-4070-add3-03b3396c4b9a'
  const route = { params: Promise.resolve({ workflowTypeGuid: CONNECT_GROUP_WORKFLOW_GUID }) }
  function request(body: FormData) {
    return postRequest(body, 'http://localhost', `http://localhost/api/rock-entry-forms/${CONNECT_GROUP_WORKFLOW_GUID}`)
  }
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isPublished.mockResolvedValue(true)
    mocks.isPublicConnectGroupGuid.mockResolvedValue(true)
    mocks.getSession.mockResolvedValue(null)
    mocks.verifyContext.mockReturnValue({ workflowTypeGuid: CONNECT_GROUP_WORKFLOW_GUID, connectGroupGuid: groupGuid, initialFieldValues: {}, allowedFields: [{ attributeGuid: CONNECT_GROUP_FIELD_GUID }], buttonTitles: ['Submit'] })
    mocks.submitForm.mockResolvedValue({ workflow: {}, action: { actionData: { message: { content: 'Thanks' } } } })
  })
  it('rejects a direct start without a selected group', async () => {
    const body = new FormData()
    body.set('intent', 'start')
    expect((await POST(request(body), route)).status).toBe(400)
    expect(mocks.startForm).not.toHaveBeenCalled()
  })
  it.each([false, true])('checks current visibility again on submission (public=%s)', async (isPublic) => {
    mocks.isPublicConnectGroupGuid.mockResolvedValue(isPublic)
    const body = new FormData()
    body.set('button', 'Submit')
    body.set('fieldValues', JSON.stringify({ [CONNECT_GROUP_FIELD_GUID]: '11111111-1111-4111-8111-111111111111' }))
    const response = await POST(request(body), route)
    expect(response.status).toBe(isPublic ? 200 : 400)
    if (isPublic) {
      expect(mocks.submitForm).toHaveBeenCalledWith(expect.objectContaining({ fieldValues: { [CONNECT_GROUP_FIELD_GUID]: groupGuid } }))
    } else {
      expect(mocks.submitForm).not.toHaveBeenCalled()
    }
  })
  it('rejects old contexts without a bound group', async () => {
    mocks.verifyContext.mockReturnValue({ workflowTypeGuid: CONNECT_GROUP_WORKFLOW_GUID })
    expect((await POST(request(new FormData()), route)).status).toBe(400)
    expect(mocks.submitForm).not.toHaveBeenCalled()
  })
})
