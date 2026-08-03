import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  NEWISH_CONNECTION_BLOCK_GUID,
  OLD_NEWISH_WORKFLOW_GUID,
  ensureNewishConnectionForm,
} from './newish-form'

const closingCta = {
  blockType: 'cta',
  heading: 'We would love to meet you',
  text: 'Existing closing copy',
}

function form(overrides: Record<string, unknown> = {}) {
  return {
    blockType: 'formEmbed',
    sourceType: 'connectionOpportunity',
    rockConnectionBlockGuid: NEWISH_CONNECTION_BLOCK_GUID,
    layout: 'centered',
    ...overrides,
  }
}

describe('ensureNewishConnectionForm', () => {
  it('is wired into the seed while existing Workflow blocks stay explicit', () => {
    const source = readFileSync(new URL('./seed-pages.ts', import.meta.url), 'utf8')
    const newishSection = source.slice(
      source.indexOf("await upsertPage('newish'"),
      source.indexOf("await upsertPage('explaining-christianity'"),
    )
    expect(newishSection).toContain('layout: ensureNewishConnectionForm([')
    expect(newishSection).not.toContain(OLD_NEWISH_WORKFLOW_GUID)
    expect(source.match(/sourceType: 'workflow'/g)).toHaveLength(2)
  })

  it('inserts exactly one centered form immediately before the closing CTA', () => {
    const result = ensureNewishConnectionForm([
      { blockType: 'content', heading: 'Keep me' },
      closingCta,
    ])
    expect(result.map((block) => block.blockType)).toEqual([
      'content',
      'formEmbed',
      'cta',
    ])
    expect(result[1]).toMatchObject({
      sourceType: 'connectionOpportunity',
      rockConnectionBlockGuid: NEWISH_CONNECTION_BLOCK_GUID,
      layout: 'centered',
    })
    expect(result[1]).not.toHaveProperty('rockWorkflowGuid')
    expect(result[2]).toEqual(closingCta)
  })

  it('is idempotent when applied repeatedly', () => {
    const once = ensureNewishConnectionForm([closingCta])
    const twice = ensureNewishConnectionForm(once)
    expect(twice).toEqual(once)
    expect(twice.filter((block) => block.blockType === 'formEmbed')).toHaveLength(1)
  })

  it('converts the old Newish workflow source without retaining its GUID', () => {
    const result = ensureNewishConnectionForm([
      form({
        sourceType: 'workflow',
        rockConnectionBlockGuid: undefined,
        rockWorkflowGuid: OLD_NEWISH_WORKFLOW_GUID,
        heading: 'Preserved form copy',
      }),
      closingCta,
    ])
    expect(result[0]).toMatchObject({
      heading: 'Preserved form copy',
      sourceType: 'connectionOpportunity',
      rockConnectionBlockGuid: NEWISH_CONNECTION_BLOCK_GUID,
    })
    expect(result[0]).not.toHaveProperty('rockWorkflowGuid')
  })

  it('collapses duplicate Newish targets but preserves unrelated forms and copy', () => {
    const unrelated = form({
      rockConnectionBlockGuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      heading: 'Unrelated form',
    })
    const result = ensureNewishConnectionForm([
      form({ heading: 'Chosen copy' }),
      unrelated,
      form({ rockWorkflowGuid: OLD_NEWISH_WORKFLOW_GUID }),
      closingCta,
    ])
    expect(
      result.filter(
        (block) => block.rockConnectionBlockGuid === NEWISH_CONNECTION_BLOCK_GUID,
      ),
    ).toHaveLength(1)
    expect(result).toContainEqual(unrelated)
    expect(result.find((block) => block.heading === 'Chosen copy')).toBeTruthy()
  })

  it('fails closed when the closing CTA is absent or ambiguous', () => {
    expect(() => ensureNewishConnectionForm([])).toThrow('closing CTA')
    expect(() => ensureNewishConnectionForm([closingCta, closingCta])).toThrow(
      'closing CTA',
    )
  })
})
