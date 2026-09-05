import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  getSignedUrl: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: async () => ({ find: mocks.find }),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mocks.getSignedUrl,
}))

import { GET } from './route'

describe('sermon audio stream route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('S3_BUCKET', 'sermon-audio')
    mocks.find.mockResolvedValue({
      docs: [{ filename: 'life-in-christ.m4a', mimeType: 'audio/x-m4a' }],
    })
    mocks.getSignedUrl.mockResolvedValue('https://signed.example/life-in-christ.m4a')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('requests attachment disposition for explicit downloads', async () => {
    const response = await GET(
      new Request('https://www.ev.church/api/sermon-audio/stream?file=life-in-christ.m4a&download=1'),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://signed.example/life-in-christ.m4a')
    expect(mocks.getSignedUrl).toHaveBeenCalledOnce()
    const command = mocks.getSignedUrl.mock.calls[0]?.[1] as {
      input?: { ResponseContentDisposition?: string }
    }
    expect(command.input?.ResponseContentDisposition).toBe(
      'attachment; filename="life-in-christ.m4a"',
    )
  })

  it('keeps normal stream requests inline', async () => {
    await GET(
      new Request('https://www.ev.church/api/sermon-audio/stream?file=life-in-christ.m4a'),
    )

    const command = mocks.getSignedUrl.mock.calls[0]?.[1] as {
      input?: { ResponseContentDisposition?: string }
    }
    expect(command.input?.ResponseContentDisposition).toBeUndefined()
  })
})
