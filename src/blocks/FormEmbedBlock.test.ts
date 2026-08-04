import { describe, expect, it } from 'vitest'

import {
  activeFormIdentifier,
  validateEligibleRockConnectionBlockGuid,
  validateRockConnectionBlockGuid,
  validateRockWorkflowGuid,
} from './FormEmbedBlock'

const workflowGuid = '00778880-81fe-4871-aa91-7c81783b8c4d'
const blockGuid = '70f9eb00-5961-42bc-b1ea-dbcb8fce6369'

describe('FormEmbed source validation', () => {
  it('defaults compatibility rows to Workflow and requires only its active identifier', () => {
    expect(validateRockWorkflowGuid(workflowGuid, {})).toBe(true)
    expect(validateRockWorkflowGuid(null, {})).toBe('Choose a public Rock Form Builder workflow.')
    expect(validateRockConnectionBlockGuid(null, {})).toBe(true)
  })

  it('requires only the Connection Signup identifier for that source', () => {
    const siblings = { sourceType: 'connectionOpportunity' }
    expect(validateRockConnectionBlockGuid(blockGuid, siblings)).toBe(true)
    expect(validateRockConnectionBlockGuid(null, siblings)).toBe('Choose an eligible Rock Connection Signup configuration.')
    expect(validateRockWorkflowGuid('stale-not-a-guid', siblings)).toBe(true)
  })

  it('rejects malformed active identifiers without letting inactive stale data block publishing', () => {
    expect(validateRockWorkflowGuid('not-a-guid', { sourceType: 'workflow' })).toBe('Choose a public Rock Form Builder workflow.')
    expect(validateRockConnectionBlockGuid('not-a-guid', { sourceType: 'connectionOpportunity' })).toBe('Choose an eligible Rock Connection Signup configuration.')
    expect(validateRockConnectionBlockGuid('stale', { sourceType: 'workflow' })).toBe(true)
  })

  it('fails publishing closed when the selected Connection configuration is no longer eligible', async () => {
    const siblings = { sourceType: 'connectionOpportunity' }
    await expect(validateEligibleRockConnectionBlockGuid(
      blockGuid.toUpperCase(),
      siblings,
      async () => true,
    )).resolves.toBe(true)
    await expect(validateEligibleRockConnectionBlockGuid(
      blockGuid,
      siblings,
      async () => false,
    )).resolves.toContain('no longer eligible')
    await expect(validateEligibleRockConnectionBlockGuid(
      blockGuid,
      siblings,
      async () => { throw new Error('offline') },
    )).resolves.toContain('Unable to verify')
  })

  it('clears the inactive identifier when the source changes', () => {
    expect(activeFormIdentifier(workflowGuid, { sourceType: 'connectionOpportunity' }, 'workflow')).toBeNull()
    expect(activeFormIdentifier(blockGuid, { sourceType: 'workflow' }, 'connectionOpportunity')).toBeNull()
    expect(activeFormIdentifier(workflowGuid, { sourceType: 'workflow' }, 'workflow')).toBe(workflowGuid)
    expect(activeFormIdentifier(blockGuid, { sourceType: 'connectionOpportunity' }, 'connectionOpportunity')).toBe(blockGuid)
  })
})
