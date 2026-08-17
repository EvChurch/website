import { afterEach, describe, expect, it, vi } from 'vitest'

const { s3Send, sharp } = vi.hoisted(() => ({
  s3Send: vi.fn(),
  sharp: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('blur')),
  })),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: vi.fn(),
  S3Client: vi.fn(() => ({ send: s3Send })),
}))
vi.mock('sharp', () => ({ default: sharp }))

import { generateBlurPlaceholder } from './generateBlurPlaceholder'

describe('generateBlurPlaceholder', () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.S3_BUCKET
  })

  it('generates a placeholder from the incoming upload before S3 stores it', async () => {
    process.env.S3_BUCKET = 'production-media'
    s3Send.mockRejectedValue(new Error('NoSuchKey'))

    const uploadBuffer = Buffer.from('original image')
    const update = vi.fn().mockResolvedValue(undefined)
    const doc = {
      id: 248,
      filename: 'event.jpg',
      mimeType: 'image/jpeg',
    }

    const result = await generateBlurPlaceholder({
      collection: null,
      context: {},
      doc,
      operation: 'create',
      previousDoc: undefined,
      req: {
        file: { data: uploadBuffer },
        payload: {
          logger: { error: vi.fn() },
          update,
        },
      },
    } as never)

    expect(sharp).toHaveBeenCalledWith(uploadBuffer)
    expect(s3Send).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({
      collection: 'media',
      id: 248,
      data: { blurDataURL: 'data:image/png;base64,Ymx1cg==' },
      context: { skipBlurGeneration: true },
    })
    expect(result).toMatchObject({
      blurDataURL: 'data:image/png;base64,Ymx1cg==',
    })
  })
})
