import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  getSignedUrl: vi.fn(),
  trackNotFound: vi.fn(),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class S3Client {
    constructor(readonly input: unknown) {}
  },
  GetObjectCommand: class GetObjectCommand {
    constructor(readonly input: unknown) {}
  },
  HeadObjectCommand: class HeadObjectCommand {
    constructor(readonly input: unknown) {}
  },
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mocks.getSignedUrl,
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: async () => ({ find: mocks.find }),
}))

vi.mock('@/lib/tracked-not-found', () => ({
  trackNotFound: mocks.trackNotFound,
}))

import { GET, HEAD } from './route'

function request(method: 'GET' | 'HEAD', file = 'a-sermon.m4a') {
  return new Request(`https://www.ev.church/api/sermon-audio/stream?file=${file}`, {
    method,
  })
}

describe('sermon audio stream route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('S3_BUCKET', 'sermon-audio')
    vi.stubEnv('S3_REGION', 'auto')
    vi.stubEnv('S3_ACCESS_KEY_ID', 'test-access-key')
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'test-secret-key')
    mocks.find.mockResolvedValue({
      docs: [{ filename: 'a-sermon.m4a', mimeType: 'audio/x-m4a' }],
    })
    mocks.getSignedUrl.mockResolvedValue('https://storage.example/a-sermon.m4a?signed=1')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('signs S3 HEAD requests with HeadObject so browser metadata probes do not use a GET signature', async () => {
    const response = await HEAD(request('HEAD'))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://storage.example/a-sermon.m4a?signed=1')
    expect(mocks.getSignedUrl).toHaveBeenCalledOnce()
    const command = mocks.getSignedUrl.mock.calls[0][1]
    expect(command.constructor.name).toBe('HeadObjectCommand')
    expect(command.input).toEqual({
      Bucket: 'sermon-audio',
      Key: 'a-sermon.m4a',
    })
  })

  it('keeps GET requests on GetObject for audio playback bytes', async () => {
    const response = await GET(request('GET'))

    expect(response.status).toBe(302)
    const command = mocks.getSignedUrl.mock.calls[0][1]
    expect(command.constructor.name).toBe('GetObjectCommand')
  })
  it('requests attachment disposition only for explicit downloads', async () => {
    const response = await GET(request('GET', 'a-sermon.m4a&download=1'))

    expect(response.status).toBe(302)
    const command = mocks.getSignedUrl.mock.calls[0][1]
    expect(command.constructor.name).toBe('GetObjectCommand')
    expect(command.input).toEqual({
      Bucket: 'sermon-audio',
      Key: 'a-sermon.m4a',
      ResponseContentDisposition: 'attachment; filename="a-sermon.m4a"',
    })
  })

  it('keeps normal stream requests inline', async () => {
    await GET(request('GET'))
    expect(mocks.getSignedUrl.mock.calls[0][1].input.ResponseContentDisposition).toBeUndefined()
  })

  it('looks up encoded filenames once and signs the original storage key', async () => {
    mocks.find.mockResolvedValue({
      docs: [{ filename: 'a sermon.m4a', prefix: 'uploads', mimeType: 'audio/x-m4a' }],
    })

    await GET(request('GET', 'a%20sermon.m4a&download=1'))

    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { filename: { equals: 'a sermon.m4a' } },
    }))
    expect(mocks.getSignedUrl.mock.calls[0][1].input).toEqual({
      Bucket: 'sermon-audio',
      Key: 'uploads/a sermon.m4a',
      ResponseContentDisposition: 'attachment; filename="a sermon.m4a"',
    })
  })
})
