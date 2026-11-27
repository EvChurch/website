import type { CourseBlock, CourseLesson, CourseSnapshot } from './model'

export interface LessonStep { id: string; title: string; blocks: CourseBlock[] }

function text(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const node = value as Record<string, unknown>
  return typeof node.text === 'string' ? node.text : Array.isArray(node.children) ? node.children.map(text).join('') : ''
}

function heading(block: CourseBlock) {
  if (block.blockType !== 'courseTeaching') return ''
  const first = block.body.root.children[0]
  return first?.type === 'heading' ? text(first).trim() : ''
}

export function courseDisplayBlock(block: CourseBlock, mode: 'solo' | 'group'): CourseBlock {
  if (mode !== 'solo') return block
  if (block.blockType === 'courseTeaching' && block.individualBody && text(block.individualBody.root).trim()) return { ...block, body: block.individualBody }
  if (block.blockType === 'courseQuestion') return {
    ...block,
    prompt: block.individualPrompt?.trim() || block.prompt,
    guidance: block.individualGuidance?.trim() || block.guidance,
  }
  return block
}

function substantive(block: CourseBlock) {
  return block.blockType !== 'courseTeaching' || block.body.root.children.some(node => node.type !== 'heading' && text(node).trim())
}

/** Keep reading context with the next activity; never show a heading by itself. */
export function lessonSteps(lesson: CourseLesson, mode: 'solo' | 'group' = 'group'): LessonStep[] {
  const steps: LessonStep[] = []
  let pending: CourseBlock[] = [], title = 'Get started', pendingTitle = title, start = 0
  const flush = () => {
    if (!pending.length) return
    if (!pending.some(substantive) && steps.length) steps[steps.length - 1].blocks.push(...pending)
    else steps.push({ id: pending[0].id || `step-${start}`, title: pendingTitle, blocks: pending })
    pending = []
  }
  for (const [index, block] of (lesson.blocks ?? []).entries()) {
    const nextHeading = heading(block)
    if (nextHeading && pending.some(substantive)) flush()
    if (nextHeading) title = heading(courseDisplayBlock(block, mode)) || 'Reflect'
    if (!pending.length) { start = index; pendingTitle = title }
    else if (nextHeading) pendingTitle = title
    if (block.blockType === 'courseBudget' || block.blockType === 'courseVideo') pendingTitle = block.title
    pending.push(block)
    if (['courseQuestion', 'coursePrompt', 'courseBudget', 'courseVideo'].includes(block.blockType)) flush()
  }
  flush()
  return steps.length ? steps : [{ id: 'start', title: lesson.title, blocks: [] }]
}

export function currentCourseLesson(snapshot: CourseSnapshot, completed: string[]) {
  return snapshot.lessons.find(lesson => !completed.includes(lesson.lessonId)) ?? snapshot.lessons[0]
}

export function canAccessCourseLesson(snapshot: CourseSnapshot, completed: string[], lessonId: string) {
  const index = snapshot.lessons.findIndex(lesson => lesson.lessonId === lessonId)
  return index >= 0 && snapshot.lessons.slice(0, index).every(lesson => completed.includes(lesson.lessonId))
}

export function lessonPosition(lesson: CourseLesson, positions: unknown) {
  const steps = lessonSteps(lesson)
  const saved = positions && typeof positions === 'object' && !Array.isArray(positions)
    ? (positions as Record<string, unknown>)[lesson.lessonId] : null
  return steps.some(step => step.id === saved) ? saved as string : steps[0].id
}
