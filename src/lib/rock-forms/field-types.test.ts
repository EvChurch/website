import { describe, expect, it } from 'vitest'
import { parseRockOptions, ROCK_FIELD_TYPES } from './field-types'

describe('Rock field type inventory', () => {
  it('keeps the 17 field types used by the public form inventory distinct', () => {
    const fieldTypes = Object.values(ROCK_FIELD_TYPES)
    expect(fieldTypes).toHaveLength(17)
    expect(new Set(fieldTypes)).toHaveLength(17)
  })

  it('rejects malformed option configuration', () => {
    expect(parseRockOptions('{not-json')).toEqual([])
    expect(parseRockOptions('{"value":"not-an-array"}')).toEqual([])
  })
})
