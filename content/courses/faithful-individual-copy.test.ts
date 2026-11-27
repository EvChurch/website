import { describe, expect, it } from 'vitest'
import type { Course } from '@/payload-types'
import { faithfulWithMoneyCourse } from './faithful-with-money'
import { enrichFaithfulIndividualCopy } from './faithful-individual-copy'
import patches from '../../src/migrations/data/20261127_faithful_individual_copy.json'

export function originalLessons(): Course['lessons'] {
  const lessons = structuredClone(faithfulWithMoneyCourse.lessons)
  for (const patch of patches) {
    const block = lessons.find(lesson => lesson.lessonId === patch.lessonId)!.blocks!.find(block => block.id === patch.blockId)!
    const fields = block as unknown as Record<string, unknown>
    fields[patch.field] = structuredClone(patch.expected)
    if ('individualField' in patch && patch.individualField) delete fields[patch.individualField]
  }
  return lessons
}

describe('reviewed individual course copy', () => {
  it('adds warm individual instructions without changing learner answer contracts', () => {
    const before = originalLessons()
    const result = enrichFaithfulIndividualCopy(before)
    expect(result.changed).toBe(true)
    expect(result.lessons.map(lesson => lesson.lessonId)).toEqual(before.map(lesson => lesson.lessonId))
    for (const [i, lesson] of result.lessons.entries()) {
      expect(lesson.blocks!.map(block => block.id)).toEqual(before[i].blocks!.map(block => block.id))
      for (const block of lesson.blocks!) if (block.blockType === 'courseQuestion') {
        const old = before[i].blocks!.find(item => item.id === block.id)!
        if (old.blockType !== 'courseQuestion') throw new Error('Changed block type')
        expect([block.visibility, block.inputType, block.choices]).toEqual([old.visibility, old.inputType, old.choices])
      }
    }
    const intro = result.lessons[0].blocks![0]
    expect(intro.blockType).toBe('courseTeaching')
    if (intro.blockType !== 'courseTeaching') throw new Error('Wrong block')
    expect(JSON.stringify(intro.individualBody)).toContain('Take your time with the Bible passages')
    expect(JSON.stringify(intro.individualBody)).not.toMatch(/alone|solo|on your own|together/i)
    expect(JSON.stringify(intro.body)).toContain('Take turns reading aloud')
    const talk = result.lessons[1].blocks!.find(block => block.id === 's2-block-007')!
    if (talk.blockType !== 'courseTeaching') throw new Error('Wrong block')
    expect(talk.individualBody!.root.children).toHaveLength(talk.body.root.children.length)
    expect(JSON.stringify(talk.individualBody)).toContain('strangest fundraising report')
    expect(JSON.stringify(talk.individualBody)).toContain('read it slowly')
  })
  it('preserves human edits, including existing individual overrides', () => {
    const lessons = originalLessons()
    const changed = lessons[0].blocks![0]
    if (changed.blockType !== 'courseTeaching') throw new Error('Wrong block')
    changed.body = structuredClone(changed.body)
    changed.body.root.children = []
    const ownOverride = lessons[0].blocks!.find(block => block.id === 's1-block-026')!
    if (ownOverride.blockType !== 'courseQuestion') throw new Error('Wrong block')
    ownOverride.individualPrompt = 'An editor’s individual prompt'
    const result = enrichFaithfulIndividualCopy(lessons)
    expect(result.lessons[0].blocks![0]).toEqual(changed)
    const retained = result.lessons[0].blocks!.find(block => block.id === ownOverride.id)!
    expect(retained).toMatchObject({ individualPrompt: 'An editor’s individual prompt' })
    expect(enrichFaithfulIndividualCopy(result.lessons).changed).toBe(false)
  })
})
