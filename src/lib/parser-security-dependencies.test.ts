// @vitest-environment happy-dom

import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const payloadRequire = createRequire(import.meta.resolve('payload'))
const schemaRequire = createRequire(payloadRequire.resolve('json-schema-to-typescript'))

describe('resolved and shipped parser security', () => {
  it('counts empty YAML merge sources against the configured work limit', () => {
    const yaml: {
      load: (source: string, options?: { maxTotalMergeKeys: number; schema: unknown }) => unknown
      CORE_SCHEMA: { withTags: (tag: unknown) => unknown }
      mergeTag: unknown
    } = schemaRequire('js-yaml')
    expect(yaml.load('campus: Auckland')).toEqual({ campus: 'Auckland' })
    // YAML 5 disables merge keys by default; exercise the opt-in parser too.
    const source = 'empty: &empty {}\nmerged:\n  <<: [*empty, *empty, *empty]\n'
    expect(yaml.load(source)).toEqual({ empty: {}, merged: { '<<': [{}, {}, {}] } })
    expect(() => yaml.load(source, {
      schema: yaml.CORE_SCHEMA.withTags(yaml.mergeTag),
      maxTotalMergeKeys: 2,
    })).toThrow(/maxTotalMergeKeys/)
  })
})
