import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  getSignedUrl: vi.fn(),
  trackNotFound: vi.fn(),
  stat: vi.fn(),
  open: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({ stat: mocks.stat, open: mocks.open }))

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
import { GET as fileGET, HEAD as fileHEAD } from '../file/[filename]/route'

function request(method: 'GET' | 'HEAD', file = 'a-sermon.m4a') {
  return new Request(`https://www.ev.church/api/sermon-audio/stream?file=${file}`, {
    method,
  })
}

describe.each(['stream', 'file'] as const)('sermon audio %s route', (route) => {
  async function handle(request: Request) {
    if (route === 'stream') return request.method === 'HEAD' ? HEAD(request) : GET(request)
    const url = new URL(request.url)
    const filename = url.searchParams.get('file') ?? ''
    url.pathname = `/api/sermon-audio/file/${encodeURIComponent(filename)}`
    // The path must win over a conflicting query parameter.
    url.searchParams.set('file', 'different-file.m4a')
    const fileRequest = new Request(url, request)
    const context = { params: Promise.resolve({ filename }) }
    return request.method === 'HEAD' ? fileHEAD(fileRequest, context) : fileGET(fileRequest, context)
  }
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
    const response = await handle(request('HEAD'))

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
    const response = await handle(request('GET'))

    expect(response.status).toBe(302)
    const command = mocks.getSignedUrl.mock.calls[0][1]
    expect(command.constructor.name).toBe('GetObjectCommand')
  })
  it('requests attachment disposition only for explicit downloads', async () => {
    const response = await handle(request('GET', 'a-sermon.m4a&download=1'))

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
    await handle(request('GET'))
    expect(mocks.getSignedUrl.mock.calls[0][1].input.ResponseContentDisposition).toBeUndefined()
  })

  it('looks up encoded filenames once and signs the original storage key', async () => {
    mocks.find.mockResolvedValue({
      docs: [{ filename: 'a sermon.m4a', prefix: 'uploads', mimeType: 'audio/x-m4a' }],
    })

    await handle(request('GET', 'a%20sermon.m4a&download=1'))

    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { filename: { equals: 'a sermon.m4a' } },
    }))
    expect(mocks.getSignedUrl.mock.calls[0][1].input).toEqual({
      Bucket: 'sermon-audio',
      Key: 'uploads/a sermon.m4a',
      ResponseContentDisposition: 'attachment; filename="a sermon.m4a"',
    })
  })

  it.each(['GET', 'HEAD'] as const)('returns an uncached, temporary %s redirect without reading audio bytes', async (method) => {
    const response = await handle(request(method))
    expect(response.status).toBe(302)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store')
    expect(await response.text()).toBe('')
    expect(mocks.getSignedUrl.mock.calls[0][2]).toEqual({ expiresIn: 43200 })
    expect(mocks.open).not.toHaveBeenCalled()
  })

  it.each(['GET', 'HEAD'] as const)('does not sign missing files for %s', async (method) => {
    mocks.find.mockResolvedValue({ docs: [] })
    expect((await handle(request(method))).status).toBe(404)
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it('keeps byte-range playback working with local storage', async () => {
    vi.stubEnv('S3_BUCKET', '')
    mocks.stat.mockResolvedValue({ size: 10 })
    const close = vi.fn()
    const read = vi.fn(async (buffer: Buffer) => { buffer.fill('a') })
    mocks.open.mockResolvedValue({ read, close })
    const response = await handle(new Request(request('GET'), { headers: { Range: 'bytes=2-4' } }))
    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Range')).toBe('bytes 2-4/10')
    expect(await response.text()).toBe('aaa')
    expect(read).toHaveBeenCalledWith(expect.any(Buffer), 0, 3, 2)
    expect(close).toHaveBeenCalledOnce()
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it('keeps local HEAD probes bodyless', async () => {
    vi.stubEnv('S3_BUCKET', '')
    mocks.stat.mockResolvedValue({ size: 10 })
    const response = await handle(request('HEAD'))
    expect(response.headers.get('Content-Length')).toBe('10')
    expect(await response.text()).toBe('')
    expect(mocks.open).not.toHaveBeenCalled()
  })
})
