import { afterEach, describe, expect, it, vi } from 'vitest'

const { s3Send } = vi.hoisted(() => ({
  s3Send: vi.fn(),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class {
    constructor(input: Record<string, unknown>) {
      Object.assign(this, input)
    }
  },
  S3Client: class {
    send = s3Send
  },
}))

import { loadMediaFileForFocalPoint } from './loadMediaFileForFocalPoint'

describe('loadMediaFileForFocalPoint', () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.S3_BUCKET
  })

  it('loads the original directly from S3 before Payload regenerates focal-point sizes', async () => {
    process.env.S3_BUCKET = 'production-media'
    const image = Buffer.from('original image')
    s3Send.mockResolvedValue({
      Body: {
        transformToByteArray: vi.fn().mockResolvedValue(image),
      },
    })

    const findByID = vi.fn().mockResolvedValue({
      filename: 'team-member.jpg',
      focalX: 50,
      focalY: 50,
      mimeType: 'image/jpeg',
      prefix: 'people',
    })
    const req = {
      query: {
        uploadEdits: {
          focalPoint: { x: 72, y: 18 },
        },
      },
      payload: { findByID },
      user: { roles: ['editor'] },
    }
    const args = {
      data: {
        filename: 'forged-audio.mp3',
        focalX: 50,
        focalY: 50,
        mimeType: 'audio/mpeg',
        prefix: 'sermon-audio',
      },
      id: 251,
    }

    await loadMediaFileForFocalPoint({
      args,
      collection: {},
      context: {},
      operation: 'update',
      req,
    } as never)

    expect(s3Send).toHaveBeenCalledWith({
      Bucket: 'production-media',
      Key: 'people/team-member.jpg',
    })
    expect(findByID).toHaveBeenCalledWith({
      collection: 'media',
      id: 251,
      depth: 0,
      overrideAccess: true,
      req,
    })
    expect((args as { overwriteExistingFiles?: boolean }).overwriteExistingFiles).toBe(true)
    expect(req).toMatchObject({
      file: {
        data: image,
        mimetype: 'image/jpeg',
        name: 'team-member.jpg',
        size: image.length,
      },
    })
  })

  it('does not load from S3 when the focal point did not change', async () => {
    process.env.S3_BUCKET = 'production-media'
    const req = {
      query: {
        uploadEdits: {
          focalPoint: { x: 50, y: 50 },
        },
      },
      payload: {
        findByID: vi.fn().mockResolvedValue({
          filename: 'team-member.jpg',
          focalX: 50,
          focalY: 50,
          mimeType: 'image/jpeg',
        }),
      },
      user: { roles: ['editor'] },
    }

    await loadMediaFileForFocalPoint({
      args: {
        data: {
          filename: 'team-member.jpg',
          focalX: 50,
          focalY: 50,
          mimeType: 'image/jpeg',
        },
        id: 251,
      },
      collection: {},
      context: {},
      operation: 'update',
      req,
    } as never)

    expect(s3Send).not.toHaveBeenCalled()
    expect(req).not.toHaveProperty('file')
  })

  it('does not read from S3 before access checks for an unauthenticated request', async () => {
    process.env.S3_BUCKET = 'production-media'

    await loadMediaFileForFocalPoint({
      args: {
        data: {
          filename: 'team-member.jpg',
          focalX: 50,
          focalY: 50,
          mimeType: 'image/jpeg',
        },
        id: 251,
      },
      collection: {},
      context: {},
      operation: 'update',
      req: {
        query: {
          uploadEdits: {
            focalPoint: { x: 72, y: 18 },
          },
        },
        payload: {},
        user: null,
      },
    } as never)

    expect(s3Send).not.toHaveBeenCalled()
  })

  it('preserves an incoming upload instead of replacing it with the stored file', async () => {
    process.env.S3_BUCKET = 'production-media'
    const incomingFile = {
      data: Buffer.from('replacement image'),
      mimetype: 'image/jpeg',
      name: 'replacement.jpg',
      size: 17,
    }
    const findByID = vi.fn()
    const req = {
      file: incomingFile,
      query: {
        uploadEdits: {
          focalPoint: { x: 72, y: 18 },
        },
      },
      payload: { findByID },
      user: { roles: ['editor'] },
    }

    await loadMediaFileForFocalPoint({
      args: { data: {}, id: 251 },
      collection: {},
      context: {},
      operation: 'update',
      req,
    } as never)

    expect(findByID).not.toHaveBeenCalled()
    expect(s3Send).not.toHaveBeenCalled()
    expect(req.file).toBe(incomingFile)
  })
})
