import RichText from '@/components/blocks/RichTextRenderer'
import { getPayloadClient } from '@/lib/payload'
import { OtherCourseAnswers } from './OtherCourseAnswers'
import { CourseQuestion } from './CourseQuestion'
import { CourseBudget } from './CourseBudget'
import type { CourseAnswerState } from '@/lib/courses/answer-model'
import type { CourseBlock } from '@/lib/courses/model'
import { courseDisplayBlock } from '@/lib/courses/lesson-flow'

export async function CourseContent({ blocks, attemptId, lessonId, answers = {}, mode = 'group' }: { blocks: CourseBlock[]; attemptId?: number; lessonId?: string; answers?: Record<string, CourseAnswerState>; mode?: 'solo' | 'group' }) {
  return <div className="space-y-8">{await Promise.all(blocks.map(async original => {
    const block = courseDisplayBlock(original, mode)
    if (block.blockType === 'courseBudget') return attemptId && lessonId && answers[block.id!] ? <div key={block.id}><CourseBudget block={block} attemptId={attemptId} lessonId={lessonId} initial={answers[block.id!]} />{answers[block.id!].scope === 'individual-shared' && <OtherCourseAnswers attemptId={attemptId} lessonId={lessonId} blockId={block.id!} />}</div> : <section key={block.id}><h2 className="text-2xl font-bold">{block.title}</h2><p className="mt-2 text-sm text-mid-grey">{block.visibility === 'shared' ? 'Shared' : 'Personal'}{block.required ? ' · Required' : ''}</p>{block.instructions && <p className="mt-3 text-mid-grey">{block.instructions}</p>}</section>
    if (block.blockType === 'coursePrompt') return <section key={block.id}><h2 className="text-xl font-bold">{block.prompt}</h2>{block.guidance && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-rich-red">A way in</summary><p className="mt-3 whitespace-pre-line text-mid-grey">{block.guidance}</p></details>}</section>
    if (block.blockType === 'courseQuestion') return attemptId && lessonId && answers[block.id!] ? <div key={block.id}><CourseQuestion block={block} attemptId={attemptId} lessonId={lessonId} initial={answers[block.id!]} />{answers[block.id!].scope === 'individual-shared' && <OtherCourseAnswers attemptId={attemptId} lessonId={lessonId} blockId={block.id!} choices={block.choices?.map(choice => ({ choiceId: choice.choiceId, label: choice.label }))} />}</div> : <section key={block.id}><h2 className="text-xl font-bold">{block.prompt}</h2><p className="mt-2 text-sm text-mid-grey">{block.visibility === 'shared' ? 'Shared' : 'Personal'}{block.required ? ' · Required' : ''}</p>{block.guidance && <p className="mt-3 text-mid-grey">{block.guidance}</p>}</section>
    if (block.blockType === 'courseTeaching') return <div key={block.id} className="prose max-w-none text-lg leading-relaxed"><RichText data={block.body} /></div>
    if (block.blockType === 'courseVideo') return <a key={block.id} href={block.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-warm-grey bg-white p-6 font-bold text-rich-red">Watch: {block.title} ↗</a>
    if (block.blockType === 'courseImage') {
      const image = typeof block.image === 'number' ? await (await getPayloadClient()).findByID({ collection: 'media', id: block.image, depth: 0, select: { url: true, alt: true }, overrideAccess: true }) : block.image
      return image?.url ? <figure key={block.id}><img src={image.url} alt={image.alt ?? ''} className="max-h-[36rem] w-full rounded-xl object-contain" />{block.caption && <figcaption className="mt-2 text-sm text-mid-grey">{block.caption}</figcaption>}</figure> : null
    }
    return null
  }))}</div>
}
