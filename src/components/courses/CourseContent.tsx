import RichText from '@/components/blocks/RichTextRenderer'
import { getPayloadClient } from '@/lib/payload'
import type { CourseBlock } from '@/lib/courses/model'

export async function CourseContent({ blocks }: { blocks: CourseBlock[] }) {
  return <div className="space-y-8">{await Promise.all(blocks.map(async block => {
    if (block.blockType === 'courseTeaching') return <div key={block.id} className="prose max-w-none text-lg leading-relaxed"><RichText data={block.body} /></div>
    if (block.blockType === 'courseVideo') return <a key={block.id} href={block.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-warm-grey bg-white p-6 font-bold text-rich-red">Watch: {block.title} ↗</a>
    if (block.blockType === 'courseImage') {
      const image = typeof block.image === 'number' ? await (await getPayloadClient()).findByID({ collection: 'media', id: block.image, depth: 0, select: { url: true, alt: true }, overrideAccess: true }) : block.image
      return image?.url ? <figure key={block.id}><img src={image.url} alt={image.alt ?? ''} className="max-h-[36rem] w-full rounded-xl object-contain" />{block.caption && <figcaption className="mt-2 text-sm text-mid-grey">{block.caption}</figcaption>}</figure> : null
    }
    return null
  }))}</div>
}
