import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AUTH0_ROCK_ENTITY_TYPE_GUID,
  GivingRockClientError,
  createGivingRockClient,
} from './rock-client'

const config = {
  apiUrl: 'https://rock.example.church/api',
  apiKey: 'test-key',
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function numericResponse(value: number, status: 200 | 201) {
  return new Response(String(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function cancellableResponse(status: number, headers: Record<string,string> = { 'content-type': 'application/json' }) {
  const cancel = vi.fn()
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('[]')) }, cancel }), { status, headers })
  return { response, cancel }
}

describe('giving Rock client', () => {
  afterEach(() => vi.restoreAllMocks())

  it('uses the dedicated exact API origin and bounded active email query', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]))
    const client = createGivingRockClient({ ...config, fetchImpl })

    await client.findActivePeopleByEmail('ada@example.com')

    const [url, init] = fetchImpl.mock.calls[0]
    expect(new URL(url).origin).toBe('https://rock.example.church')
    expect(new URL(url).searchParams.get('$filter')).toBe(
      "tolower(Email) eq 'ada@example.com' and RecordStatusValueId eq 3 and IsDeceased eq false",
    )
    expect(new URL(url).searchParams.get('$orderby')).toBe('Id')
    expect(new URL(url).searchParams.get('$top')).toBe('3')
    expect(init).toMatchObject({ redirect: 'error', cache: 'no-store' })
    expect(init.headers).toMatchObject({ 'Authorization-Token': 'test-key' })
  })

  it('resolves a signed-in subject only through the exact Auth0 login and fresh person read', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{
        Id: 1,
        EntityTypeId: 9,
        PersonId: 42,
        UserName: 'AUTH0_auth0|member',
        EntityType: { Id: 9, Guid: AUTH0_ROCK_ENTITY_TYPE_GUID },
      }]))
      .mockResolvedValueOnce(jsonResponse({
        Id: 42,
        PrimaryAliasId: 84,
        Guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
        FirstName: null,
        NickName: 'Ada',
        LastName: 'Lovelace',
        Email: null,
      }))
    const client = createGivingRockClient({ ...config, fetchImpl })

    await expect(client.resolveSignedInPerson('auth0|member')).resolves.toEqual({
      id: 42,
      primaryAliasId: 84,
      guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: null,
    })
    expect(new URL(fetchImpl.mock.calls[0][0]).searchParams.get('$expand')).toBe('EntityType')
    expect(new URL(fetchImpl.mock.calls[1][0]).pathname).toBe('/api/People/42')
  })

  it.each([201, 200] as const)('accepts a Rock %s bare numeric Person.Id and validates People/{id}', async (status) => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(numericResponse(42, status))
      .mockResolvedValueOnce(jsonResponse({ Id: 42, PrimaryAliasId: 84, Guid: status === 200 ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : '22e31fd2-e649-43d5-b350-8a620f68ca1d' }))
    const client = createGivingRockClient({ ...config, fetchImpl })

    await expect(client.createPerson({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
    })).resolves.toMatchObject({ id: 42, primaryAliasId: 84 })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      FirstName: 'Ada', NickName: 'Ada', LastName: 'Lovelace', Email: 'ada@example.com', Guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
      IsSystem: false, Gender: 0,
    })
    expect(new URL(fetchImpl.mock.calls[1][0]).pathname).toBe('/api/People/42')
  })

  it.each([500, 502])('marks a create %s as unknown and never retries it', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status }))
    const client = createGivingRockClient({ ...config, fetchImpl, getRetries: 2 })

    await expect(client.createPerson({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
    })).rejects.toMatchObject({ code: 'create-unknown', outcome: 'unknown' })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('treats a failed post-create GUID verification as unknown', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(numericResponse(42, 201))
      .mockResolvedValueOnce(new Response('{malformed'))
    const client = createGivingRockClient({ ...config, fetchImpl })

    await expect(client.createPerson({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
    })).rejects.toMatchObject({ code: 'create-unknown', outcome: 'unknown' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['mismatched person id', { Id: 43, PrimaryAliasId: 84, Guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d' }],
    ['invalid primary alias', { Id: 42, PrimaryAliasId: 0, Guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d' }],
  ])('treats create validation with %s as unknown', async (_label, createdPerson) => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(numericResponse(42, 201))
      .mockResolvedValueOnce(jsonResponse(createdPerson))
    const client = createGivingRockClient({ ...config, fetchImpl })

    await expect(client.createPerson({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
    })).rejects.toMatchObject({ code: 'create-unknown', outcome: 'unknown' })
  })

  it('bounds GET retries but rejects redirects and oversized or malformed JSON without leaking bodies', async () => {
    const discarded = cancellableResponse(503)
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(discarded.response)
      .mockResolvedValueOnce(jsonResponse([]))
    const client = createGivingRockClient({ ...config, fetchImpl, getRetries: 1, retryDelayMs: 0 })
    await expect(client.findActivePeopleByEmail('ada@example.com')).resolves.toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(discarded.cancel).toHaveBeenCalledOnce()

    const malformed = createGivingRockClient({ ...config, fetchImpl: vi.fn().mockResolvedValue(new Response('{secret-body')) })
    const error = await malformed.findActivePeopleByEmail('ada@example.com').catch((caught) => caught)
    expect(error).toBeInstanceOf(GivingRockClientError)
    expect(String(error)).not.toContain('secret-body')
  })

  it('requires application/json for reads and treats a create content-type mismatch as unknown', async () => {
    const discarded = cancellableResponse(200, { 'content-type': 'text/plain' })
    const readClient = createGivingRockClient({
      ...config,
      fetchImpl: vi.fn().mockResolvedValue(discarded.response),
    })
    await expect(readClient.findActivePeopleByEmail('ada@example.com')).rejects.toMatchObject({ code: 'response-invalid', outcome: 'failed' })
    expect(discarded.cancel).toHaveBeenCalledOnce()

    const createClient = createGivingRockClient({
      ...config,
      fetchImpl: vi.fn().mockResolvedValue(new Response('42', { status: 201 })),
    })
    await expect(createClient.createPerson({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', guid: '22e31fd2-e649-43d5-b350-8a620f68ca1d',
    })).rejects.toMatchObject({ code: 'create-unknown', outcome: 'unknown' })
  })

  it('rejects non-exact API configuration before a request', () => {
    expect(() => createGivingRockClient({ ...config, apiUrl: 'http://rock.example.church/api' })).toThrow(/configuration/i)
    expect(() => createGivingRockClient({ ...config, apiUrl: 'https://rock.example.church/api?token=x' })).toThrow(/configuration/i)
  })
})
