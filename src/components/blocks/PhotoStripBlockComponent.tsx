import Image from 'next/image'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

interface PhotoImage {
  image: { url: string; alt: string } | string
}

interface PhotoStripBlockProps {
  layout?: 'horizontalScroll' | 'grid4' | 'grid2' | 'masonry' | null
  images: PhotoImage[]
}

function getUrl(img: PhotoImage): string {
  return typeof img.image === 'string' ? img.image : img.image?.url ?? ''
}

function getAlt(img: PhotoImage): string {
  return typeof img.image === 'string' ? '' : img.image?.alt ?? ''
}

/** Staggered height/margin pairs for horizontal scroll — matches original design */
const heightPatterns = [
  'h-72 lg:h-96',
  'h-56 lg:h-72',
  'h-64 lg:h-80',
  'h-72 lg:h-96',
  'h-56 lg:h-72',
  'h-64 lg:h-80',
] as const

const marginPatterns = [
  '',
  'mt-10',
  'mt-4',
  'mt-8',
  'mt-12',
  'mt-2',
] as const

const delayPatterns = [0, 60, 120, 180, 240, 300] as const

export function PhotoStripBlockComponent({ layout: layoutProp, images }: PhotoStripBlockProps) {
  const layout = layoutProp ?? 'horizontalScroll'

  if (layout === 'grid4') {
    return (
      <section className="bg-white px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[80rem]">
          <ScrollReveal>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-[4/3]">
                  <Image
                    src={getUrl(img)}
                    alt={getAlt(img)}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="rounded-lg object-cover"
                  />
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>
    )
  }

  if (layout === 'grid2') {
    return (
      <section className="bg-warm-white px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[80rem]">
          <ScrollReveal>
            <div className="grid grid-cols-2 gap-3">
              {images.slice(0, 2).map((img, i) => (
                <div key={i} className={`relative aspect-[3/4] ${i === 1 ? 'mt-8' : ''}`}>
                  <Image
                    src={getUrl(img)}
                    alt={getAlt(img)}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="rounded-lg object-cover"
                  />
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>
    )
  }

  if (layout === 'masonry') {
    return (
      <section className="bg-white px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[80rem]">
          <ScrollReveal>
            <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
              {images.map((img, i) => (
                <div key={i} className="mb-3 break-inside-avoid">
                  <Image
                    src={getUrl(img)}
                    alt={getAlt(img)}
                    width={600}
                    height={i % 3 === 0 ? 800 : i % 3 === 1 ? 600 : 450}
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="w-full rounded-lg object-cover"
                  />
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>
    )
  }

  // horizontalScroll layout
  // Mobile: auto-scrolling marquee loop
  // Desktop: staggered height flex row
  const marqueeImages = [...images, ...images]

  return (
    <section className="overflow-hidden bg-white py-16 lg:py-24">
      {/* Mobile: auto-scrolling marquee */}
      <div className="flex gap-3 lg:hidden" style={{ width: 'max-content', animation: 'marquee 30s linear infinite' }}>
        {marqueeImages.map((img, i) => (
          <Image
            key={i}
            src={getUrl(img)}
            alt={getAlt(img)}
            width={300}
            height={400}
            sizes="70vw"
            className="h-64 w-auto shrink-0 rounded-lg object-cover"
          />
        ))}
      </div>
      <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>

      {/* Desktop: staggered height row */}
      <div className="-mx-2 hidden items-start gap-4 lg:flex">
        {images.map((img, i) => {
          const heightClass = heightPatterns[i % heightPatterns.length]
          const marginClass = marginPatterns[i % marginPatterns.length]
          const delay = delayPatterns[i % delayPatterns.length]

          return (
            <ScrollReveal key={i} delay={delay}>
              <Image
                src={getUrl(img)}
                alt={getAlt(img)}
                width={600}
                height={800}
                sizes="300px"
                className={`${heightClass} ${marginClass} w-auto shrink-0 rounded-lg object-cover transition-all duration-500 hover:scale-105 hover:-rotate-1 hover:shadow-xl hover:shadow-brand-black/10`}
              />
            </ScrollReveal>
          )
        })}
      </div>
    </section>
  )
}
