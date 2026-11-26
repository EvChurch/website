import RichText from '@/components/blocks/RichTextRenderer'
import { getPayloadClient } from '@/lib/payload'
import { CourseQuestion } from './CourseQuestion'
import type { CourseAnswerState } from '@/lib/courses/answer-model'
import type { CourseBlock } from '@/lib/courses/model'

export async function CourseContent({ blocks, attemptId, lessonId, answers = {} }: { blocks: CourseBlock[]; attemptId?: number; lessonId?: string; answers?: Record<string, CourseAnswerState> }) {
  return <div className="space-y-8">{await Promise.all(blocks.map(async block => {
    if (block.blockType === 'coursePrompt') return <section key={block.id}><h2 className="text-xl font-bold">{block.prompt}</h2>{block.guidance && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-rich-red">A way in</summary><p className="mt-3 whitespace-pre-line text-mid-grey">{block.guidance}</p></details>}</section>
    if (block.blockType === 'courseQuestion') return attemptId && lessonId && answers[block.id!] ? <CourseQuestion key={block.id} block={block} attemptId={attemptId} lessonId={lessonId} initial={answers[block.id!]} /> : <section key={block.id}><h2 className="text-xl font-bold">{block.prompt}</h2><p className="mt-2 text-sm text-mid-grey">{block.visibility === 'shared' ? 'Shared' : 'Personal'}{block.required ? ' · Required' : ''}</p>{block.guidance && <p className="mt-3 text-mid-grey">{block.guidance}</p>}</section>
    if (block.blockType === 'courseTeaching') return <div key={block.id} className="prose max-w-none text-lg leading-relaxed"><RichText data={block.body} /></div>
    if (block.blockType === 'courseVideo') return <a key={block.id} href={block.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-warm-grey bg-white p-6 font-bold text-rich-red">Watch: {block.title} ↗</a>
    if (block.blockType === 'courseImage') {
      const image = typeof block.image === 'number' ? await (await getPayloadClient()).findByID({ collection: 'media', id: block.image, depth: 0, select: { url: true, alt: true }, overrideAccess: true }) : block.image
      return image?.url ? <figure key={block.id}><img src={image.url} alt={image.alt ?? ''} className="max-h-[36rem] w-full rounded-xl object-contain" />{block.caption && <figcaption className="mt-2 text-sm text-mid-grey">{block.caption}</figcaption>}</figure> : null
    }
    return null
  }))}</div>
}
