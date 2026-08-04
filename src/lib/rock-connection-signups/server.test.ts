import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID,
  initializeRockConnectionSignup,
  listEligibleRockConnectionSignups,
  RockConnectionSignupOutcomeUnknownError,
  sendRockConnectionSignup,
} from './server'

const blockGuid = '70f9eb00-5961-42bc-b1ea-dbcb8fce6369'
const pageGuid = 'c6bde74e-b1e0-4aa7-8bf2-2b4bd16bfb72'
const opportunityGuid = '11111111-1111-4111-8111-111111111111'

function jsonResponse(value: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function metadataBlock(overrides: Record<string, unknown> = {}) {
  return {
    Guid: blockGuid,
    IsActive: true,
    Name: 'Newish signup proxy',
    PageId: 42,
    LayoutId: null,
    SiteId: null,
    BlockType: {
      Guid: CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID,
      Name: 'Connection Opportunity Signup',
      IsActive: true,
    },
    AttributeValues: {
      ConnectionOpportunity: { Value: opportunityGuid },
      ExcludeNonPublicAttributes: { Value: 'True' },
      DisableCaptchaSupport: { Value: 'True' },
    },
    ...overrides,
  }
}

function pageMetadata(overrides: Record<string, unknown> = {}) {
  return {
    Id: 42,
    Guid: pageGuid,
    InternalName: 'EV Newish proxy',
    PageTitle: 'EV Newish proxy',
    ...overrides,
  }
}

function opportunity(overrides: Record<string, unknown> = {}) {
  return {
    Guid: opportunityGuid,
    Name: 'Newish',
    IsActive: true,
    ConnectionTypeId: 6,
    ...overrides,
  }
}

function connectionType(overrides: Record<string, unknown> = {}) {
  return {
    Id: 6,
    Name: 'Connect',
    IsActive: true,
    ...overrides,
  }
}

function initialization(overrides: Record<string, unknown> = {}) {
  return {
    blockGuid,
    blockTypeGuid: CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID,
    configurationValues: {
      attributes: {},
      campuses: [{ value: '3', text: 'Central' }],
      commentFieldLabel: 'Anything else?',
      disableCaptchaSupport: true,
      displayHomePhone: true,
      displayMobilePhone: true,
      email: 'api-person@example.test',
      firstName: 'API',
      lastName: 'Person',
      homePhone: { number: '123' },
      mobilePhone: { number: '456' },
      selectedCampusId: 3,
      ...overrides,
    },
    reloadMode: 0,
    role: 0,
  }
}

describe('Rock connection signup server adapter', () => {
  beforeEach(() => {
    vi.stubEnv('ROCK_API_URL', 'https://rock.example.test/api')
    vi.stubEnv('ROCK_API_KEY', 'rock-api-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('discovers an eligible fixed-opportunity block and returns normalized labels only', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([metadataBlock()]))
      .mockResolvedValueOnce(jsonResponse(pageMetadata()))
      .mockResolvedValueOnce(jsonResponse([opportunity()]))
      .mockResolvedValueOnce(jsonResponse(connectionType()))
      .mockResolvedValueOnce(jsonResponse(initialization()))

    await expect(listEligibleRockConnectionSignups()).resolves.toEqual([
      {
        blockGuid,
        label: 'Newish — EV Newish proxy — Newish signup proxy',
      },
    ])

    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('accepts Rock GUIDs that do not encode RFC version or variant bits', async () => {
    const rockGuid = '01234567-89ab-cdef-0123-456789abcdef'
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([metadataBlock({ Guid: rockGuid })]))
      .mockResolvedValueOnce(jsonResponse(pageMetadata()))
      .mockResolvedValueOnce(jsonResponse([opportunity()]))
      .mockResolvedValueOnce(jsonResponse(connectionType()))
      .mockResolvedValueOnce(
        jsonResponse({ ...initialization(), blockGuid: rockGuid }),
      )

    await expect(listEligibleRockConnectionSignups()).resolves.toEqual([
      {
        blockGuid: rockGuid,
        label: 'Newish — EV Newish proxy — Newish signup proxy',
      },
    ])
  })

  it('initializes through the authenticated Rock API action with empty page parameters', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([metadataBlock()]))
      .mockResolvedValueOnce(jsonResponse(pageMetadata()))
      .mockResolvedValueOnce(jsonResponse([opportunity()]))
      .mockResolvedValueOnce(jsonResponse(connectionType()))
      .mockResolvedValueOnce(jsonResponse(initialization()))

    const schema = await initializeRockConnectionSignup(blockGuid)
    const [url, options] = fetchMock.mock.calls[4] as [string, RequestInit]
    const body = JSON.parse(String(options.body)) as {
      __context: Record<string, unknown>
    }

    expect(url).toBe(
      `https://rock.example.test/api/v2/BlockActions/${pageGuid}/${blockGuid}/RefreshObsidianBlockInitialization`,
    )
    expect(options).toMatchObject({ method: 'POST', redirect: 'error' })
    expect(options.headers).toMatchObject({
      'Authorization-Token': 'rock-api-key',
    })
    expect(options.headers).not.toHaveProperty('CF-Access-Client-Id')
    expect(body.__context.pageParameters).toEqual({})
    expect(body.__context.sessionGuid).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.__context.interactionGuid).toMatch(/^[0-9a-f-]{36}$/)
    expect(schema).toMatchObject({
      blockGuid,
      pageGuid,
      opportunityGuid,
      firstName: '',
      lastName: '',
      email: '',
      homePhone: null,
      mobilePhone: null,
      campuses: [{ value: '3', text: 'Central' }],
      selectedCampusId: 3,
    })
  })

  it.each([
    [
      'wrong block type',
      {
        BlockType: {
          Guid: '22222222-2222-4222-8222-222222222222',
          IsActive: true,
        },
      },
    ],
    ['inactive block', { IsActive: false }],
    [
      'inactive block type',
      {
        BlockType: {
          Guid: CONNECTION_OPPORTUNITY_SIGNUP_BLOCK_TYPE_GUID,
          IsActive: false,
        },
      },
    ],
    ['layout ownership', { PageId: null, LayoutId: 2 }],
    [
      'missing fixed opportunity',
      {
        AttributeValues: {
          ExcludeNonPublicAttributes: { Value: 'True' },
          DisableCaptchaSupport: { Value: 'True' },
        },
      },
    ],
    [
      'non-public attributes',
      {
        AttributeValues: {
          ConnectionOpportunity: { Value: opportunityGuid },
          ExcludeNonPublicAttributes: { Value: 'False' },
          DisableCaptchaSupport: { Value: 'True' },
        },
      },
    ],
    [
      'raw CAPTCHA enabled',
      {
        AttributeValues: {
          ConnectionOpportunity: { Value: opportunityGuid },
          ExcludeNonPublicAttributes: { Value: 'True' },
          DisableCaptchaSupport: { Value: 'False' },
        },
      },
    ],
  ])('excludes %s metadata before refresh', async (_name, overrides) => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([metadataBlock(overrides)]))

    await expect(listEligibleRockConnectionSignups()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('excludes an inactive opportunity', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([metadataBlock()]))
      .mockResolvedValueOnce(jsonResponse(pageMetadata()))
      .mockResolvedValueOnce(jsonResponse([opportunity({ IsActive: false })]))

    await expect(listEligibleRockConnectionSignups()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('excludes an inactive connection type', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([metadataBlock()]))
      .mockResolvedValueOnce(jsonResponse(pageMetadata()))
      .mockResolvedValueOnce(jsonResponse([opportunity()]))
      .mockResolvedValueOnce(jsonResponse(connectionType({ IsActive: false })))

    await expect(listEligibleRockConnectionSignups()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('excludes a block that the Rock API identity cannot view', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([metadataBlock()]))
      .mockResolvedValueOnce(jsonResponse(pageMetadata()))
      .mockResolvedValueOnce(jsonResponse([opportunity()]))
      .mockResolvedValueOnce(jsonResponse(connectionType()))
      .mockResolvedValueOnce(
        jsonResponse({ error: 'credential required' }, { status: 403 }),
      )

    await expect(listEligibleRockConnectionSignups()).resolves.toEqual([])
    const [, options] = fetchMock.mock.calls[4] as [string, RequestInit]
    expect(options.headers).toMatchObject({
      'Authorization-Token': 'rock-api-key',
    })
  })

  it('fails closed for an unsupported attribute, malformed schema, and effective CAPTCHA', async () => {
    for (const configurationValues of [
      {
        disableCaptchaSupport: true,
        displayHomePhone: false,
        displayMobilePhone: false,
        campuses: [],
        attributes: {
          Upload: {
            attributeGuid: '33333333-3333-4333-8333-333333333333',
            fieldTypeGuid: '44444444-4444-4444-8444-444444444444',
            isRequired: true,
            key: 'Upload',
            name: 'Upload',
            order: 0,
          },
        },
      },
      {
        disableCaptchaSupport: true,
        displayHomePhone: false,
        displayMobilePhone: false,
        campuses: [],
        attributes: {
          Choice: {
            attributeGuid: '33333333-3333-4333-8333-333333333333',
            fieldTypeGuid: '7525c4cb-ee6b-41d4-9b64-a08048d5a5c0',
            configurationValues: {},
            isRequired: true,
            key: 'Choice',
            name: 'Choice',
            order: 0,
          },
        },
      },
      {
        disableCaptchaSupport: false,
        displayHomePhone: false,
        displayMobilePhone: false,
        campuses: [],
        attributes: {},
      },
      { attributes: null },
    ]) {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse([metadataBlock()]))
        .mockResolvedValueOnce(jsonResponse(pageMetadata()))
        .mockResolvedValueOnce(jsonResponse([opportunity()]))
        .mockResolvedValueOnce(jsonResponse(connectionType()))
        .mockResolvedValueOnce(
          jsonResponse(initialization(configurationValues)),
        )

      await expect(initializeRockConnectionSignup(blockGuid)).rejects.toThrow(
        'not available',
      )
      vi.restoreAllMocks()
    }
  })

  it.each([
    [
      'redirect',
      new Response(null, {
        status: 302,
        headers: { location: 'https://elsewhere.test' },
      }),
    ],
    [
      'non-JSON',
      new Response('<html />', { headers: { 'content-type': 'text/html' } }),
    ],
    [
      'oversize',
      new Response(JSON.stringify({ value: 'x'.repeat(600_000) }), {
        headers: { 'content-type': 'application/json' },
      }),
    ],
  ])('fails closed on a %s response', async (_name, badResponse) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(badResponse)
    await expect(listEligibleRockConnectionSignups()).rejects.toThrow()
  })

  it('rejects malformed GUIDs without calling Rock', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(
      initializeRockConnectionSignup('../other-origin'),
    ).rejects.toThrow('valid block')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not retry a timed-out refresh', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([metadataBlock()]))
      .mockResolvedValueOnce(jsonResponse(pageMetadata()))
      .mockResolvedValueOnce(jsonResponse([opportunity()]))
      .mockResolvedValueOnce(jsonResponse(connectionType()))
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))

    await expect(initializeRockConnectionSignup(blockGuid)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('sends the exact authenticated Signup body once and returns only the 19.2 result', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        resultType: 0,
        responseMessage: '<p>Thanks</p>',
        redirectUrl: 'https://ignored.test',
      }),
    )
    const bag = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.test',
      campusId: 3,
      attributeValues: { Note: 'Hello' },
    }
    await expect(
      sendRockConnectionSignup({
        pageGuid,
        blockGuid,
        sessionGuid: '22222222-2222-4222-8222-222222222222',
        interactionGuid: '33333333-3333-4333-8333-333333333333',
        bag,
      }),
    ).resolves.toEqual({ resultType: 0, responseMessage: '<p>Thanks</p>' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      `https://rock.example.test/api/v2/BlockActions/${pageGuid}/${blockGuid}/Signup`,
    )
    expect(options.headers).toMatchObject({
      'Authorization-Token': 'rock-api-key',
    })
    expect(options.headers).not.toHaveProperty('CF-Access-Client-Id')
    expect(JSON.parse(String(options.body))).toEqual({
      __context: {
        pageParameters: {},
        sessionGuid: '22222222-2222-4222-8222-222222222222',
        interactionGuid: '33333333-3333-4333-8333-333333333333',
      },
      bag,
    })
  })

  it('does not retry a timed-out Signup and reports an indeterminate outcome', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
    await expect(
      sendRockConnectionSignup({
        pageGuid,
        blockGuid,
        sessionGuid: '22222222-2222-4222-8222-222222222222',
        interactionGuid: '33333333-3333-4333-8333-333333333333',
        bag: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.test',
        },
      }),
    ).rejects.toBeInstanceOf(RockConnectionSignupOutcomeUnknownError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      'connection failure',
      () => Promise.reject(new TypeError('connection reset')),
    ],
    [
      'server failure',
      () => Promise.resolve(jsonResponse({}, { status: 500 })),
    ],
    [
      'malformed success',
      () =>
        Promise.resolve(
          new Response('{', {
            headers: { 'content-type': 'application/json' },
          }),
        ),
    ],
    [
      'invalid success schema',
      () =>
        Promise.resolve(jsonResponse({ responseMessage: 'missing result' })),
    ],
  ])('reports an indeterminate outcome after a %s', async (_name, response) => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(response)
    await expect(
      sendRockConnectionSignup({
        pageGuid,
        blockGuid,
        sessionGuid: '22222222-2222-4222-8222-222222222222',
        interactionGuid: '33333333-3333-4333-8333-333333333333',
        bag: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.test',
        },
      }),
    ).rejects.toBeInstanceOf(RockConnectionSignupOutcomeUnknownError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('preserves an explicit client rejection as a definite failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({}, { status: 400 }),
    )
    await expect(
      sendRockConnectionSignup({
        pageGuid,
        blockGuid,
        sessionGuid: '22222222-2222-4222-8222-222222222222',
        interactionGuid: '33333333-3333-4333-8333-333333333333',
        bag: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.test',
        },
      }),
    ).rejects.not.toBeInstanceOf(RockConnectionSignupOutcomeUnknownError)
  })
})
