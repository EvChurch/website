import { describe, expect, it } from 'vitest'
import { payloadStorageKey } from './payload-storage-key'

describe('Payload storage paths', () => {
  it.each([
    [{ filename: 'old.jpg' }, '', 'old.jpg'],
    [{ filename: 'old.jpg', prefix: 'people' }, '', 'people/old.jpg'],
    [{ filename: 'new.jpg', prefix: 'people', _objectKey: 'upload-id' }, '', 'people/upload-id/new.jpg'],
    [{ filename: 'new.jpg', _objectKey: 'upload-id' }, '', 'upload-id/new.jpg'],
    [{ filename: 'old.mp3' }, 'sermon-work', 'sermon-work/old.mp3'],
    [{ filename: 'new.mp3', prefix: 'sermon-work', _objectKey: 'upload-id' }, 'sermon-work', 'sermon-work/upload-id/new.mp3'],
    [{ filename: 'old.mp3', prefix: '' }, 'sermon-work', 'sermon-work/old.mp3'],
  ])('resolves stored upload %j', (file, prefix, expected) => {
    expect(payloadStorageKey(file, prefix)).toBe(expected)
  })
})
