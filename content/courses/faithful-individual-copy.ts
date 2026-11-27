import type { Course } from '@/payload-types'
import frozenPatches from '../../src/migrations/data/20261127_faithful_individual_copy.json'

type Block = NonNullable<Course['lessons'][number]['blocks']>[number]
type CopyPatch = {
  lessonId: string; blockId: string; blockType: Block['blockType']
  field: string; expected: unknown; replacement?: unknown
  individualField?: string; individualValue?: unknown
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}

/** Frozen exact matches only: never replace an editor's revised text or override. */
export function enrichFaithfulIndividualCopy(lessons: Course['lessons']) {
  let changed = false
  const updated = lessons.map(lesson => ({ ...lesson, blocks: lesson.blocks?.map(block => {
    let next = block
    for (const patch of frozenPatches as CopyPatch[]) {
      if (patch.lessonId !== lesson.lessonId || patch.blockId !== block.id || patch.blockType !== block.blockType) continue
      const fields = next as unknown as Record<string, unknown>
      if (canonical(fields[patch.field]) !== canonical(patch.expected)) continue
      if ('replacement' in patch) { next = { ...next, [patch.field]: patch.replacement } as Block; changed = true }
      if (patch.individualField && fields[patch.individualField] == null) {
        next = { ...next, [patch.individualField]: patch.individualValue } as Block
        changed = true
      }
    }
    return next
  }) }))
  return { lessons: changed ? updated : lessons, changed }
}
