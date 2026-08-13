import { MediaImage } from '@/components/media/MediaImage'
import type { PayloadMediaImage } from '@/lib/payload-media'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

type MediaUpload = PayloadMediaImage & { id: string }

interface GalleryImage {
  image: MediaUpload | string
  id?: string
}

interface ImageGalleryBlockProps {
  images: GalleryImage[]
}

export function ImageGalleryBlockComponent({ images }: ImageGalleryBlockProps) {
  const resolvedImages = images
    .map((item) => (typeof item.image !== 'string' ? { ...item.image, itemId: item.id } : null))
    .filter(Boolean) as (MediaUpload & { itemId?: string })[]

  if (resolvedImages.length === 0) return null

  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        <div
          className={`grid gap-4 ${
            resolvedImages.length === 1
              ? 'grid-cols-1'
              : resolvedImages.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : resolvedImages.length === 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}
        >
          {resolvedImages.map((img, index) => (
            <ScrollReveal key={img.itemId ?? img.id ?? index} delay={index * 80}>
              <div className="group relative overflow-hidden rounded-lg">
                <MediaImage
                  media={img}
                  mediaSize="large"
                  width={img.width ?? 800}
                  height={img.height ?? 600}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes={
                    resolvedImages.length === 1
                      ? '100vw'
                      : resolvedImages.length === 2
                        ? '(max-width: 640px) 100vw, 50vw'
                        : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
                  }
                />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
