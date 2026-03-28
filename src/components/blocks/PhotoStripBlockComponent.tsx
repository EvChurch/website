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
      <section className="bg-white py-16 lg:py-24">
        <ScrollReveal>
          <div className="columns-2 gap-1.5 md:columns-3 lg:columns-4">
            {images.map((img, i) => (
              <div key={i} className="mb-1.5 break-inside-avoid">
                <Image
                  src={getUrl(img)}
                  alt={getAlt(img)}
                  width={600}
                  height={i % 3 === 0 ? 800 : i % 3 === 1 ? 600 : 450}
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="w-full object-cover"
                />
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>
    )
  }

  // horizontalScroll layout — edge-to-edge, no max-w container
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className="flex w-full gap-1.5">
        {images.map((img, i) => {
          const delay = delayPatterns[i % delayPatterns.length]

          return (
            <ScrollReveal key={i} delay={delay} className="relative min-w-0 flex-1">
              <div className="relative aspect-[3/4] overflow-hidden sm:aspect-[4/5] lg:aspect-[3/4]">
                <Image
                  src={getUrl(img)}
                  alt={getAlt(img)}
                  fill
                  sizes={`${Math.round(100 / images.length)}vw`}
                  className="object-cover"
                />
              </div>
            </ScrollReveal>
          )
        })}
      </div>
    </section>
  )
}
