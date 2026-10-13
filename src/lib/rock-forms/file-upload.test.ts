import { describe, expect, it } from 'vitest'
import {
  resolveRockBinaryFileTypeGuid,
  ROCK_DEFAULT_BINARY_FILE_TYPE_GUID,
} from './file-upload'

const configuredGuid = '66666666-6666-4666-8666-666666666666'

describe('Rock form file uploads', () => {
  it('uses a configured bare file type GUID', () => {
    expect(resolveRockBinaryFileTypeGuid(configuredGuid)).toBe(configuredGuid)
  })

  it('uses a configured serialized Rock list item', () => {
    expect(
      resolveRockBinaryFileTypeGuid(
        JSON.stringify({ text: 'Receipts', value: configuredGuid }),
      ),
    ).toBe(configuredGuid)
  })

  it('matches Rock by using its default file type when none is configured', () => {
    expect(resolveRockBinaryFileTypeGuid('')).toBe(
      ROCK_DEFAULT_BINARY_FILE_TYPE_GUID,
    )
  })
})
