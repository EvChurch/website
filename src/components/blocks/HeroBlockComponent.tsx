import { MediaImage } from '@/components/media/MediaImage'
import { Button, ArrowRight } from '@/components/ui/Button'

interface MediaUpload {
  id: string
  url: string
  alt: string
  width?: number
  height?: number
  blurDataURL?: string | null
}

interface HeroButton {
  label: string
  href: string
  variant?: 'primary' | 'secondary' | 'text'
  id?: string
}

type OverlayStyle = 'default' | 'cinematic' | 'leftToRight'
type MinHeight = '50vh' | '70vh' | '80vh' | '85vh'

interface HeroBlockProps {
  image: MediaUpload | string
  eyebrow?: string | null
  heading: string
  highlightedText?: string | null
  subtitle?: string | null
  supportingText?: string | null
  buttons?: HeroButton[] | null
  keyColor?: string | null
  overlayStyle?: OverlayStyle | null
  minHeight?: MinHeight | null
  semanticH1?: boolean | null
}

const heightClasses: Record<MinHeight, string> = {
  '50vh': 'min-h-[50vh]',
  '70vh': 'min-h-[70vh]',
  '80vh': 'min-h-[80vh]',
  '85vh': 'min-h-[85vh]',
}

function renderHeading(heading: string, highlightedText?: string | null, keyColor?: string | null) {
  if (!highlightedText) return heading

  const parts = heading.split(highlightedText)
  if (parts.length === 1) return heading

  return (
    <>
      {parts[0]}
      <span
        className={`italic ${keyColor ? '' : 'text-light-red-3'}`}
        style={keyColor ? { color: keyColor } : undefined}
      >
        {highlightedText}
      </span>
      {parts[1]}
    </>
  )
}

function Overlays({ style, keyColor }: { style: OverlayStyle; keyColor?: string | null }) {
  // Color fade overlay — uses keyColor at 20% opacity, or defaults to rich-red
  const colorOverlayClass = keyColor ? '' : 'bg-gradient-to-tr from-rich-red/20 via-transparent to-transparent'
  const colorOverlayStyle = keyColor
    ? { background: `linear-gradient(to top right, ${keyColor}33, transparent, transparent)` }
    : undefined

  switch (style) {
    case 'cinematic':
      return (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/60 via-40% to-transparent" />
          <div className={`absolute inset-0 ${colorOverlayClass}`} style={colorOverlayStyle} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(15,0,4,0.5)_100%)]" />
        </>
      )
    case 'leftToRight':
      return (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-brand-black/80 via-brand-black/60 to-brand-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black/50 to-transparent" />
        </>
      )
    default:
      return (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/60 via-40% to-transparent" />
          <div className={`absolute inset-0 ${colorOverlayClass}`} style={colorOverlayStyle} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(15,0,4,0.5)_100%)]" />
        </>
      )
  }
}

export function HeroBlockComponent({
  image,
  eyebrow,
  heading,
  highlightedText,
  subtitle,
  supportingText,
  buttons,
  keyColor,
  overlayStyle,
  minHeight,
  semanticH1,
}: HeroBlockProps) {
  const imageUrl = typeof image === 'string' ? image : image?.url
  const height = minHeight ?? '70vh'
  const overlay = overlayStyle ?? 'default'
  const eyebrowColorClass = keyColor ? '' : 'text-light-red-2'
  const eyebrowColorStyle = keyColor ? { color: keyColor } : undefined

  return (
    <section className={`relative flex items-center overflow-hidden bg-brand-black ${heightClasses[height]}`}>
      {/* Background image */}
      {imageUrl && (
        <div className="absolute inset-0">
          <MediaImage
            media={typeof image === 'string' ? image : image}
            fill
            priority
            sizes="100vw"
            className="h-full w-full object-cover"
          />
          <Overlays style={overlay} keyColor={keyColor} />
        </div>
      )}

      {/* Content */}
      <div className="relative mx-auto max-w-[80rem] px-5 py-32 lg:px-8 lg:py-40">
        <div className="max-w-2xl">
          {eyebrow && semanticH1 ? (
            <h1
              className={`animate-fade-in-up m-0 font-sans text-xs font-semibold uppercase tracking-[0.2em] ${eyebrowColorClass}`}
              style={{ animationDelay: '100ms', ...eyebrowColorStyle }}
            >
              {eyebrow}
            </h1>
          ) : eyebrow ? (
            <p
              className={`animate-fade-in-up text-xs font-semibold uppercase tracking-[0.2em] ${eyebrowColorClass}`}
              style={{ animationDelay: '100ms', ...eyebrowColorStyle }}
            >
              {eyebrow}
            </p>
          ) : null}

          {semanticH1 ? (
            <h2
              className="animate-fade-in-up mt-6 font-serif text-display font-normal leading-display text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
              style={{ animationDelay: '200ms' }}
            >
              {renderHeading(heading, highlightedText, keyColor)}
            </h2>
          ) : (
            <h1
              className="animate-fade-in-up mt-6 font-serif text-display font-normal leading-display text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
              style={{ animationDelay: '200ms' }}
            >
              {renderHeading(heading, highlightedText, keyColor)}
            </h1>
          )}

          {subtitle && (
            <p
              className="animate-fade-in-up mt-4 max-w-lg text-base leading-body-lg text-warm-grey/80 md:mt-6 md:text-lg"
              style={{ animationDelay: '350ms' }}
            >
              {subtitle}
            </p>
          )}

          {buttons && buttons.length > 0 && (
            <div
              className="animate-fade-in-up mt-10 flex flex-wrap items-center gap-4"
              style={{ animationDelay: '500ms' }}
            >
              {buttons.map((btn) => (
                <Button
                  key={btn.id ?? btn.href}
                  href={btn.href}
                  variant={btn.variant ?? 'primary'}
                  size="large"
                  {...(btn.variant === 'text' ? { className: 'text-warm-white/90 hover:text-white' } : {})}
                >
                  {btn.label}
                  {btn.variant === 'text' && <ArrowRight />}
                </Button>
              ))}
            </div>
          )}

          {supportingText && (
            <p
              className="animate-fade-in-up mt-8 hidden max-w-lg text-sm leading-relaxed text-warm-grey/60 md:block"
              style={{ animationDelay: '600ms' }}
            >
              {supportingText}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
