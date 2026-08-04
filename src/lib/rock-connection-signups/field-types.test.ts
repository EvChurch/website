import { describe, expect, it } from 'vitest'

import type { RockConnectionSignupAttribute } from './types'
import {
  getConnectionAttributeControl,
  ROCK_CONNECTION_FIELD_TYPES,
} from './field-types'

function attribute(
  fieldTypeGuid: string,
  configurationValues: Record<string, string> = {},
): RockConnectionSignupAttribute {
  return {
    attributeGuid: '44444444-4444-4444-8444-444444444444',
    fieldTypeGuid,
    key: 'Question',
    name: 'Question',
    description: 'A helpful description',
    isRequired: true,
    order: 1,
    configurationValues,
  }
}

describe('Rock Connection attribute controls', () => {
  it.each([
    [ROCK_CONNECTION_FIELD_TYPES.text, 'text'],
    [ROCK_CONNECTION_FIELD_TYPES.memo, 'memo'],
    [ROCK_CONNECTION_FIELD_TYPES.boolean, 'boolean'],
    [ROCK_CONNECTION_FIELD_TYPES.date, 'date'],
    [ROCK_CONNECTION_FIELD_TYPES.integer, 'integer'],
    [ROCK_CONNECTION_FIELD_TYPES.currency, 'currency'],
    [ROCK_CONNECTION_FIELD_TYPES.phone, 'phone'],
    [ROCK_CONNECTION_FIELD_TYPES.url, 'url'],
  ])('maps %s to a bounded %s control', (guid, kind) => {
    expect(getConnectionAttributeControl(attribute(guid))).toMatchObject({
      available: true,
      kind,
      maxLength: expect.any(Number),
    })
  })

  it('strictly parses Rock list options as text/value pairs', () => {
    const control = getConnectionAttributeControl(attribute(
      ROCK_CONNECTION_FIELD_TYPES.singleSelect,
      { values: JSON.stringify([{ value: 'central', text: '<img src=x>Central' }]) },
    ))
    expect(control).toEqual({
      available: true,
      kind: 'singleSelect',
      maxLength: 200,
      options: [{ value: 'central', text: '<img src=x>Central' }],
    })
  })

  it('uses the documented client bounds for supported text-like fields', () => {
    expect(getConnectionAttributeControl(attribute(ROCK_CONNECTION_FIELD_TYPES.text))).toMatchObject({ maxLength: 500 })
    expect(getConnectionAttributeControl(attribute(ROCK_CONNECTION_FIELD_TYPES.memo))).toMatchObject({ maxLength: 4_000 })
    expect(getConnectionAttributeControl(attribute(ROCK_CONNECTION_FIELD_TYPES.phone))).toMatchObject({ maxLength: 50 })
    expect(getConnectionAttributeControl(attribute(ROCK_CONNECTION_FIELD_TYPES.url))).toMatchObject({ maxLength: 2_048 })
  })

  it.each([
    ['unsupported type', attribute('99999999-9999-4999-8999-999999999999')],
    ['missing select options', attribute(ROCK_CONNECTION_FIELD_TYPES.singleSelect)],
    ['malformed select options', attribute(ROCK_CONNECTION_FIELD_TYPES.multiSelect, { values: '[{"text":"No value"}]' })],
    ['oversized option', attribute(ROCK_CONNECTION_FIELD_TYPES.singleSelect, { values: JSON.stringify([{ value: 'x', text: 'x'.repeat(161) }]) })],
  ])('fails closed for %s', (_name, value) => {
    expect(getConnectionAttributeControl(value)).toEqual({
      available: false,
      reason: 'This signup includes a field that is not supported on the website.',
    })
  })
})
