import { MediaImage } from '@/components/media/MediaImage'
import type { PayloadMediaImage } from '@/lib/payload-media'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

interface PhotoImage {
  image: (PayloadMediaImage & { url: string; alt: string }) | string
}

interface PhotoStripBlockProps {
  layout?: 'horizontalScroll' | 'grid4' | 'grid2' | 'masonry' | null
  images: PhotoImage[]
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
                  <MediaImage
                    media={img.image}
                    mediaSize="medium"
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
                  <MediaImage
                    media={img.image}
                    mediaSize="large"
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
                  <MediaImage
                    media={img.image}
                    mediaSize="medium"
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
  // Auto-scrolling marquee on both mobile and desktop
  // Falls back to static staggered grid when fewer than 5 images
  const useMarquee = images.length >= 5
  const marqueeImages = useMarquee ? [...images, ...images] : images

  if (!useMarquee) {
    // Static fallback for few images
    return (
      <section className="overflow-hidden bg-white px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[80rem]">
          <div className="flex items-start justify-center gap-4">
            {images.map((img, i) => {
              const heightClass = heightPatterns[i % heightPatterns.length]
              const marginClass = marginPatterns[i % marginPatterns.length]
              return (
                <ScrollReveal key={i} delay={delayPatterns[i % delayPatterns.length]}>
                  <MediaImage
                    media={img.image}
                    mediaSize="medium"
                    width={600}
                    height={800}
                    sizes="(max-width: 640px) 70vw, 300px"
                    className={`${heightClass} ${marginClass} w-auto shrink-0 rounded-lg object-cover`}
                  />
                </ScrollReveal>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden bg-white py-16 lg:py-24">
      <div
        className="marquee-strip flex items-start gap-3 lg:gap-4"
        style={{ width: 'max-content' }}
      >
        {marqueeImages.map((img, i) => {
          const heightClass = heightPatterns[i % heightPatterns.length]
          const marginClass = marginPatterns[i % marginPatterns.length]
          return (
            <MediaImage
              key={i}
              media={img.image}
              mediaSize="medium"
              width={600}
              height={800}
              sizes="(max-width: 1024px) 70vw, 300px"
              className={`${heightClass} ${marginClass} w-auto shrink-0 rounded-lg object-cover`}
            />
          )
        })}
      </div>
      <style>{`
        .marquee-strip {
          animation: marquee 50s linear infinite;
        }
        @media (min-width: 1024px) {
          .marquee-strip { animation-duration: 70s; }
        }
        .marquee-strip:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-strip { animation: none; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  )
}
