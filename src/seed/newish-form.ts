export const NEWISH_CONNECTION_BLOCK_GUID =
  '495cda8e-60fe-4f77-a452-932b460fb44c'
export const OLD_NEWISH_WORKFLOW_GUID =
  '00778880-81fe-4871-aa91-7c81783b8c4d'

export type SeedLayoutBlock = {
  blockType?: unknown
  heading?: unknown
  sourceType?: unknown
  rockWorkflowGuid?: unknown
  rockConnectionBlockGuid?: unknown
  [key: string]: unknown
}

const DEFAULT_NEWISH_FORM: SeedLayoutBlock = {
  blockType: 'formEmbed',
  eyebrow: 'Register your interest',
  heading: 'Come along to Newish Connect',
  description:
    'Fill out the form and our team will be in touch with details about the next Newish Connect.',
  sourceType: 'connectionOpportunity',
  rockConnectionBlockGuid: NEWISH_CONNECTION_BLOCK_GUID,
  layout: 'centered',
}

function isClosingCta(block: SeedLayoutBlock): boolean {
  return (
    block.blockType === 'cta' && block.heading === 'We would love to meet you'
  )
}

function isNewishTarget(block: SeedLayoutBlock): boolean {
  return (
    block.blockType === 'formEmbed' &&
    (block.rockConnectionBlockGuid === NEWISH_CONNECTION_BLOCK_GUID ||
      block.rockWorkflowGuid === OLD_NEWISH_WORKFLOW_GUID)
  )
}

function normalizeTarget(block: SeedLayoutBlock): SeedLayoutBlock {
  const normalized = {
    ...DEFAULT_NEWISH_FORM,
    ...block,
    sourceType: 'connectionOpportunity',
    rockConnectionBlockGuid: NEWISH_CONNECTION_BLOCK_GUID,
    layout: 'centered',
  }
  delete normalized.rockWorkflowGuid
  return normalized
}

export function ensureNewishConnectionForm<T extends SeedLayoutBlock>(
  layout: readonly T[],
): Array<T | SeedLayoutBlock> {
  const closingIndexes = layout.flatMap((block, index) =>
    isClosingCta(block) ? [index] : [],
  )
  if (closingIndexes.length !== 1) {
    throw new Error('Newish seed requires exactly one closing CTA')
  }

  const targets = layout.filter(isNewishTarget)
  const selected = normalizeTarget(targets[0] || DEFAULT_NEWISH_FORM)
  const withoutTargets = layout.filter((block) => !isNewishTarget(block))
  const closingIndex = withoutTargets.findIndex(isClosingCta)

  return [
    ...withoutTargets.slice(0, closingIndex),
    selected,
    ...withoutTargets.slice(closingIndex),
  ]
}
