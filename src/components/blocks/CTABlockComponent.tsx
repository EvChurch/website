import { MediaImage } from '@/components/media/MediaImage'
import { Button } from '@/components/ui/Button'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

interface CTAButton {
  label: string
  href: string
  variant?: 'primary' | 'secondary'
  id?: string
}

type ColorPreset = 'primary-red' | 'light' | 'dark'

interface MediaRef {
  id: string
  url: string
  alt: string
  width?: number
  height?: number
  blurDataURL?: string | null
}

interface CTABlockProps {
  heading: string
  text?: string | null
  supportingText?: string | null
  buttons?: CTAButton[] | null
  colorPreset?: ColorPreset | null
  accentColor?: string | null
  backgroundImage?: MediaRef | string | null
}

const NOISE_TEXTURE =
  'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")'

export function CTABlockComponent({
  heading,
  text,
  supportingText,
  buttons,
  colorPreset = 'primary-red',
  accentColor,
  backgroundImage,
}: CTABlockProps) {
  const preset = colorPreset ?? 'primary-red'
  const bgImageUrl = backgroundImage ? (typeof backgroundImage === 'string' ? backgroundImage : backgroundImage.url) : null
  const hasBgImage = !!bgImageUrl

  // Determine background color — accentColor overrides preset
  const bgColor = accentColor ?? (preset === 'primary-red' ? 'bg-rich-red' : preset === 'dark' ? 'bg-brand-black' : 'bg-warm-white')
  const useCustomBg = !!accentColor
  const isColored = preset === 'primary-red' || preset === 'dark' || useCustomBg || hasBgImage

  return (
    <section
      className={`relative overflow-hidden px-5 py-20 lg:px-8 lg:py-28 ${hasBgImage ? 'bg-brand-black' : useCustomBg ? '' : bgColor}`}
      style={useCustomBg && !hasBgImage ? { backgroundColor: accentColor } : undefined}
    >
      {/* Background image with dark overlay */}
      {hasBgImage && (
        <>
          <MediaImage
            media={typeof backgroundImage === 'string' ? backgroundImage : backgroundImage!}
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-brand-black/70" />
        </>
      )}

      {/* Subtle noise texture for colored backgrounds */}
      {isColored && !hasBgImage && (
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: NOISE_TEXTURE, backgroundRepeat: 'repeat' }}
        />
      )}

      {/* Warm glow */}
      {isColored && !hasBgImage && (
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-[80px]" />
      )}

      <div className="relative mx-auto max-w-2xl text-center">
        <ScrollReveal>
          <h2
            className={`text-h1 leading-display ${
              isColored ? 'text-white' : 'text-brand-black'
            }`}
          >
            {heading}
          </h2>

          {text && (
            <p
              className={`mt-5 text-lg leading-body-lg ${
                preset === 'primary-red' && !useCustomBg
                  ? 'text-light-red-3'
                  : isColored
                    ? 'text-white/80'
                    : 'text-dark-grey'
              }`}
            >
              {text}
            </p>
          )}

          {supportingText && (
            <p
              className={`mt-3 hidden text-sm md:block ${
                isColored ? 'text-white/60' : 'text-mid-grey'
              }`}
            >
              {supportingText}
            </p>
          )}

          {buttons && buttons.length > 0 && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              {buttons.map((btn, index) => {
                if (index === 0 && isColored) {
                  // Primary button on colored bg — white pill
                  const textColor = useCustomBg
                    ? undefined
                    : preset === 'primary-red'
                      ? 'text-rich-red'
                      : 'text-brand-black'
                  return (
                    <a
                      key={btn.id ?? btn.href}
                      href={btn.href}
                      className={`inline-flex items-center justify-center cursor-pointer rounded-md bg-white px-8 py-3.5 text-base font-semibold shadow-lg transition-all duration-200 hover:bg-warm-white hover:shadow-xl active:scale-[0.97] ${textColor ?? ''}`}
                      style={useCustomBg ? { color: accentColor } : undefined}
                    >
                      {btn.label}
                    </a>
                  )
                }

                if (index > 0 && isColored) {
                  // Secondary button on colored bg — text variant
                  return (
                    <Button
                      key={btn.id ?? btn.href}
                      href={btn.href}
                      variant="text"
                      className="text-white/90 hover:text-white"
                    >
                      {btn.label}
                    </Button>
                  )
                }

                // Light preset buttons
                return (
                  <Button
                    key={btn.id ?? btn.href}
                    href={btn.href}
                    variant={btn.variant === 'secondary' ? 'secondary' : 'primary'}
                  >
                    {btn.label}
                  </Button>
                )
              })}
            </div>
          )}
        </ScrollReveal>
      </div>
    </section>
  )
}
