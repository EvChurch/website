import { MediaImage } from '@/components/media/MediaImage'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import RichText from '@/components/blocks/RichTextRenderer'

/** Renders words wrapped in *asterisks* as italic red accents */
function renderHighlightedHeading(text: string) {
  const parts = text.split(/(\*[^*]+\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <span key={i} className="font-serif italic text-rich-red">
          {part.slice(1, -1)}
        </span>
      )
    }
    return part
  })
}

interface MediaUpload {
  id: string
  url: string
  alt: string
  width?: number
  height?: number
  blurDataURL?: string | null
}

interface ContentBlockProps {
  heading?: string | null
  body: unknown
  image?: MediaUpload | string | null
  alignment?: 'left' | 'center' | 'right' | null
}

export function ContentBlockComponent({
  heading,
  body,
  image,
  alignment = 'left',
}: ContentBlockProps) {
  const imageData = image && typeof image !== 'string' ? image : null
  const hasImage = !!imageData
  const isCenter = alignment === 'center'

  return (
    <section className="bg-white px-5 py-16 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-[80rem]">
        <ScrollReveal>
          {isCenter || !hasImage ? (
            <div className={isCenter ? 'mx-auto max-w-3xl text-center' : ''}>
              {heading && (
                <h2 className="mt-3 text-h2 leading-heading text-brand-black">
                  {renderHighlightedHeading(heading)}
                </h2>
              )}
              <div className="mt-6 space-y-4 text-lg leading-body-lg text-dark-grey">
                <RichText data={body} />
              </div>
              {isCenter && imageData && (
                <div className="relative mt-12">
                  <MediaImage
                    media={imageData}
                    width={imageData.width ?? 1200}
                    height={imageData.height ?? 800}
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="mx-auto rounded-lg"
                  />
                </div>
              )}
            </div>
          ) : (
            <div
              className={`grid gap-16 lg:grid-cols-2 lg:items-center ${
                alignment === 'right' ? 'lg:[direction:rtl]' : ''
              }`}
            >
              <div className="lg:[direction:ltr]">
                {heading && (
                  <h2 className="text-h2 leading-heading text-brand-black">
                    {heading}
                  </h2>
                )}
                <div className="mt-6 space-y-4 text-lg leading-body-lg text-dark-grey">
                  <RichText data={body} />
                </div>
              </div>
              <div className="relative lg:[direction:ltr]">
                <MediaImage
                  media={imageData}
                  width={imageData.width ?? 1200}
                  height={imageData.height ?? 800}
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="w-full rounded-lg object-cover"
                />
              </div>
            </div>
          )}
        </ScrollReveal>
      </div>
    </section>
  )
}
