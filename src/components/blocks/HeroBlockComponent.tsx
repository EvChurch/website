import { MediaImage } from '@/components/media/MediaImage'
import type { PayloadMediaImage } from '@/lib/payload-media'
import { Button, ArrowRight } from '@/components/ui/Button'

type MediaUpload = PayloadMediaImage & { id: string }

interface HeroButton {
  label: string
  href: string
  variant?: 'primary' | 'secondary' | 'text'
  id?: string
}

type OverlayStyle = 'default' | 'cinematic' | 'leftToRight' | 'banner'
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
        className={`font-serif italic drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${keyColor ? '' : 'text-hero-highlight'}`}
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

function HeroContent({
  eyebrow,
  heading,
  highlightedText,
  subtitle,
  supportingText,
  buttons,
  keyColor,
  semanticH1,
}: Pick<
  HeroBlockProps,
  'eyebrow' | 'heading' | 'highlightedText' | 'subtitle' | 'supportingText' | 'buttons' | 'keyColor' | 'semanticH1'
>) {
  const eyebrowColorClass = keyColor ? '' : 'text-hero-eyebrow'
  const eyebrowColorStyle = keyColor ? { color: keyColor } : undefined

  return (
    <>
      {eyebrow && semanticH1 ? (
        <h1
          className={`animate-fade-in-up m-0 font-sans text-xs font-semibold uppercase tracking-[0.2em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] ${eyebrowColorClass}`}
          style={{ animationDelay: '100ms', ...eyebrowColorStyle }}
        >
          {eyebrow}
        </h1>
      ) : eyebrow ? (
        <p
          className={`animate-fade-in-up text-xs font-semibold uppercase tracking-[0.2em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] ${eyebrowColorClass}`}
          style={{ animationDelay: '100ms', ...eyebrowColorStyle }}
        >
          {eyebrow}
        </p>
      ) : null}

      {semanticH1 ? (
        <h2
          className="animate-fade-in-up mt-6 text-display leading-display text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
          style={{ animationDelay: '200ms' }}
        >
          {renderHeading(heading, highlightedText, keyColor)}
        </h2>
      ) : (
        <h1
          className="animate-fade-in-up mt-6 text-display leading-display text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
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
              {...(btn.variant === 'text' ? { className: 'ml-2 text-warm-white/90 hover:text-white' } : {})}
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
    </>
  )
}

function SplitHeroContent({
  eyebrow,
  heading,
  highlightedText,
  subtitle,
  supportingText,
  buttons,
  keyColor,
  semanticH1,
}: Pick<
  HeroBlockProps,
  'eyebrow' | 'heading' | 'highlightedText' | 'subtitle' | 'supportingText' | 'buttons' | 'keyColor' | 'semanticH1'
>) {
  const eyebrowStyle = keyColor ? { color: keyColor } : undefined
  const headingContent = renderHeading(heading, highlightedText, keyColor)
  const headingClassName =
    'mt-[1.125rem] text-[clamp(3.375rem,15vw,4.5rem)] leading-[0.86] tracking-[-0.055em] text-white sm:text-[clamp(4rem,9vw,5.25rem)] lg:text-[clamp(4rem,6.2vw,5.25rem)]'

  return (
    <>
      {eyebrow && semanticH1 ? (
        <h1 className="m-0 text-xs font-bold uppercase tracking-[0.24em] text-light-red-2" style={eyebrowStyle}>
          {eyebrow}
        </h1>
      ) : eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-light-red-2" style={eyebrowStyle}>
          {eyebrow}
        </p>
      ) : null}

      {semanticH1 ? (
        <h2 className={headingClassName}>{headingContent}</h2>
      ) : (
        <h1 className={headingClassName}>{headingContent}</h1>
      )}

      {subtitle && (
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
          {subtitle}
        </p>
      )}

      {buttons && buttons.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-4">
          {buttons.map((btn) => (
            <Button
              key={btn.id ?? btn.href}
              href={btn.href}
              variant={btn.variant ?? 'primary'}
              size="large"
              {...(btn.variant === 'text' ? { className: 'ml-2 text-warm-white/90 hover:text-white' } : {})}
            >
              {btn.label}
              {btn.variant === 'text' && <ArrowRight />}
            </Button>
          ))}
        </div>
      )}

      {supportingText && (
        <p className="mt-7 hidden max-w-xl text-sm leading-relaxed text-white/60 md:block">
          {supportingText}
        </p>
      )}
    </>
  )
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

  // Banner variant: event-detail-style split header with text beside the artwork.
  if (overlay === 'banner') {
    return (
      <section className="overflow-hidden bg-[linear-gradient(90deg,#0b0003,#18070b_50%,#0b0003)] text-white">
        <div className="mx-auto flex max-w-[80rem] flex-col pb-12 pt-20 sm:pb-16 lg:grid lg:min-h-[37.5rem] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-14 lg:px-8 lg:py-[4.5rem]">
          <div className="min-w-0 px-5 pt-10 sm:px-8 sm:pt-12 lg:px-0 lg:pt-0">
            <SplitHeroContent
              eyebrow={eyebrow}
              heading={heading}
              highlightedText={highlightedText}
              subtitle={subtitle}
              supportingText={supportingText}
              buttons={buttons}
              keyColor={keyColor}
              semanticH1={semanticH1}
            />
          </div>

          <div className="relative order-first aspect-video w-full overflow-hidden shadow-[0_28px_70px_rgba(0,0,0,0.53)] lg:order-none">
            {imageUrl && (
              <MediaImage
                media={image}
                mediaSize="hero"
                fill
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 1023px) 100vw, (max-width: 1280px) 60vw, 720px"
                className="h-full w-full object-cover"
              />
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={`relative flex items-center overflow-hidden bg-brand-black ${heightClasses[height]}`}>
      {/* Background image */}
      {imageUrl && (
        <div className="absolute inset-0">
          <MediaImage
            media={typeof image === 'string' ? image : image}
            mediaSize="hero"
            fill
            loading="eager"
            fetchPriority="high"
            sizes="100vw"
            className="h-full w-full object-cover"
          />
          <Overlays style={overlay} keyColor={keyColor} />
        </div>
      )}

      {/* Content */}
      <div className="relative mx-auto max-w-[80rem] px-5 py-20 sm:py-24 lg:px-8 lg:py-40">
        <div className="max-w-2xl">
          <HeroContent
            eyebrow={eyebrow}
            heading={heading}
            highlightedText={highlightedText}
            subtitle={subtitle}
            supportingText={supportingText}
            buttons={buttons}
            keyColor={keyColor}
            semanticH1={semanticH1}
          />
        </div>
      </div>
    </section>
  )
}
