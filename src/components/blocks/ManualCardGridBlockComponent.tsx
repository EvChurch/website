import Image from 'next/image'
import { MediaImage } from '@/components/media/MediaImage'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { Button, ArrowRight } from '@/components/ui/Button'
import { getGoogleMapsEmbedUrl, isGoogleMapsUrl } from '@/lib/google-maps'

interface CardImage {
  url: string
  alt: string
  width?: number
  height?: number
  blurDataURL?: string | null
}

interface DetailRow {
  label: string
  value: string
}

interface ManualCard {
  eyebrow?: string | null
  title: string
  subtitle?: string | null
  description?: string | null
  image?: CardImage | string | null
  href?: string | null
  linkLabel?: string | null
  address?: string | null
  details?: DetailRow[] | null
}

interface ManualCardGridBlockProps {
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  cardStyle?: 'info' | 'imageOverlay' | 'imageTop' | 'alternatingRows' | null
  columns?: string | number | null
  cards: ManualCard[]
  priority?: boolean
}

function getImageUrl(image: CardImage | string | null | undefined): string {
  if (!image) return ''
  if (typeof image === 'string') return image
  return image.url
}


const columnClasses: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

/** Inline arrow SVG used in card link labels */
function ArrowSvg() {
  return (
    <svg
      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}

function InfoCard({ card, index }: { card: ManualCard; index: number }) {
  const mapUrl = card.href && isGoogleMapsUrl(card.href) ? card.href : null
  const mapEmbedUrl = mapUrl
    ? getGoogleMapsEmbedUrl(
        mapUrl,
        card.address ?? card.description ?? card.title,
      )
    : null

  const content = (
    <div className="group relative block overflow-hidden rounded-xl border border-warm-grey/60 bg-white transition-all duration-300 hover:border-rich-red/20 hover:shadow-lg hover:shadow-rich-red/5">
      {/* Accent bar */}
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-rich-red to-light-red-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {mapEmbedUrl && (
        <iframe
          src={mapEmbedUrl}
          title={`Map showing ${card.title} campus`}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          className="aspect-[4/3] w-full border-0"
        />
      )}

      <div className="p-8">
        <h3 className="font-sans text-h4 font-bold text-brand-black">{card.title}</h3>
        {card.subtitle && (
          <p className="mt-2 text-sm text-mid-grey">{card.subtitle}</p>
        )}
        {card.description && (
          <p className="mt-3 flex-1 text-[0.9375rem] leading-relaxed text-mid-grey">
            {card.description}
          </p>
        )}
        {card.details && card.details.length > 0 && (
          <dl className="mt-4 space-y-2">
            {card.details.map((row, i) => (
              <div key={i} className="flex justify-between text-sm">
                <dt className="font-medium text-brand-black">{row.label}</dt>
                <dd className="text-mid-grey">
                  {row.value.includes('@') ? (
                    <a href={`mailto:${row.value}`} className="text-rich-red hover:text-deep-red transition-colors">
                      {row.value}
                    </a>
                  ) : row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {card.linkLabel && mapUrl ? (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-rich-red transition-colors hover:text-deep-red"
          >
            {card.linkLabel}
            <ArrowSvg />
          </a>
        ) : card.linkLabel ? (
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-rich-red transition-colors group-hover:text-deep-red">
            {card.linkLabel}
            <ArrowSvg />
          </span>
        ) : null}
      </div>
    </div>
  )

  return (
    <ScrollReveal delay={index * 100}>
      {card.href && !mapUrl ? <Link href={card.href} className="group relative block">{content}</Link> : content}
    </ScrollReveal>
  )
}

function ImageOverlayCard({ card, index, priority }: { card: ManualCard; index: number; priority?: boolean }) {
  const url = getImageUrl(card.image)

  const content = (
    <div className="group relative block aspect-[3/4] overflow-hidden rounded-xl sm:aspect-[4/5]">
      {url && card.image && (
        <MediaImage
          media={card.image}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/40 via-40% to-transparent transition-opacity duration-300 group-hover:opacity-90" />

      {/* Content anchored to bottom */}
      <div className="relative flex h-full flex-col justify-end p-7">
        {card.eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-light-red-2">
            {card.eyebrow}
          </p>
        )}
        <h3 className="mt-2 text-h2 leading-tight text-white">{card.title}</h3>
        {card.subtitle && (
          <p className="mt-2 text-sm font-medium text-warm-white/70">{card.subtitle}</p>
        )}
        {card.address && (
          <p className="mt-1 text-xs text-warm-white/50">{card.address}</p>
        )}
        {card.linkLabel && (
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-light-red-2 transition-colors group-hover:text-white">
            {card.linkLabel}
            <ArrowSvg />
          </span>
        )}
      </div>
    </div>
  )

  return (
    <ScrollReveal delay={index * 100}>
      {card.href ? <Link href={card.href} className="group relative block">{content}</Link> : content}
    </ScrollReveal>
  )
}

function ImageTopCard({ card, index, priority }: { card: ManualCard; index: number; priority?: boolean }) {
  const url = getImageUrl(card.image)
  const isTeamStyle = !card.description && !card.linkLabel

  const content = (
    <div className={`group relative block overflow-hidden rounded-xl ${isTeamStyle ? 'border border-warm-grey/60 bg-white transition-shadow duration-300 hover:shadow-lg hover:shadow-rich-red/5' : ''}`}>
      {/* Image */}
      {isTeamStyle ? (
        <div className="overflow-hidden">
          {url && card.image ? (
            <MediaImage
              media={card.image}
              width={600}
              height={600}
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-warm-grey/30 to-warm-grey/10">
              <svg className="h-20 w-20 text-warm-grey" fill="none" viewBox="0 0 24 24" strokeWidth={0.8} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          )}
        </div>
      ) : (
        <div className="relative aspect-[16/10] overflow-hidden">
          {url && card.image ? (
            <MediaImage
              media={card.image}
              fill
              priority={priority}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-warm-grey/20" />
          )}
        </div>
      )}

      {/* Content panel */}
      {isTeamStyle ? (
        <div className="p-5 text-center">
          <h3 className="font-sans text-base font-bold text-brand-black">{card.title}</h3>
          {card.subtitle && <p className="mt-1 text-sm text-mid-grey">{card.subtitle}</p>}
          {card.details && card.details.length > 0 && (
            <div className="mt-2">
              {card.details.map((row, i) => (
                row.value.includes('@') ? (
                  <a key={i} href={`mailto:${row.value}`} className="text-xs text-rich-red transition-colors hover:text-deep-red">
                    {row.value}
                  </a>
                ) : (
                  <p key={i} className="text-xs text-mid-grey">{row.value}</p>
                )
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-brand-black p-7">
          <h3 className="text-h4 text-white">{card.title}</h3>
          {card.description && (
            <p className="mt-2 text-sm leading-relaxed text-warm-grey/60">{card.description}</p>
          )}
          {card.linkLabel && (
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-light-red-2 transition-colors group-hover:text-white">
              {card.linkLabel}
              <ArrowSvg />
            </span>
          )}
        </div>
      )}
    </div>
  )

  return (
    <ScrollReveal delay={index * 100}>
      {card.href ? <Link href={card.href} className="group relative block">{content}</Link> : content}
    </ScrollReveal>
  )
}

function AlternatingRowCard({ card, index }: { card: ManualCard; index: number }) {
  const url = getImageUrl(card.image)
  const isEven = index % 2 === 1

  return (
    <ScrollReveal delay={index * 100}>
      <div
        className={`grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16 ${
          isEven ? 'lg:[direction:rtl]' : ''
        }`}
      >
        {/* Image */}
        <div className="lg:[direction:ltr]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
            {url && card.image ? (
              <MediaImage
                media={card.image}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-warm-grey/20" />
            )}
          </div>
        </div>

        {/* Text */}
        <div className="lg:[direction:ltr]">
          {card.eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
              {card.eyebrow}
            </p>
          )}
          <h2 className="mt-3 text-h3 leading-heading text-brand-black">
            {card.title}
          </h2>
          {card.description && (
            <p className="mt-4 text-lg leading-relaxed text-dark-grey">{card.description}</p>
          )}
          {card.href && card.linkLabel && (
            <div className="mt-6">
              <Button href={card.href} variant="primary">
                {card.linkLabel}
                <ArrowRight />
              </Button>
            </div>
          )}
        </div>
      </div>
    </ScrollReveal>
  )
}

export function ManualCardGridBlockComponent({
  eyebrow,
  heading,
  description,
  cardStyle: cardStyleProp,
  columns: columnsProp,
  cards,
  priority,
}: ManualCardGridBlockProps) {
  const cardStyle = cardStyleProp ?? 'info'
  const columns = Number(columnsProp) || 3
  const isAlternating = cardStyle === 'alternatingRows'
  const isTeamStyle = cardStyle === 'imageTop' && cards.every(c => !c.description && !c.linkLabel)
  const isContinuation = !!description && !heading && !eyebrow

  return (
    <section className={`bg-warm-white px-5 py-24 lg:px-8 lg:py-32 ${isContinuation ? 'border-t-2 border-warm-grey' : ''}`}>
      <div className="mx-auto max-w-[80rem]">
        {/* Section header — left aligned */}
        {(eyebrow || heading || description) && (
          <ScrollReveal>
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                {eyebrow}
              </p>
            )}
            {heading && (
              <h2 className="mt-3 text-h2 leading-heading text-brand-black">
                {heading}
              </h2>
            )}
            {description && isTeamStyle ? (
              <h3 className="mt-8 text-center text-h3 text-brand-black">
                {description}
              </h3>
            ) : description ? (
              <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-dark-grey">
                {description}
              </p>
            ) : null}
          </ScrollReveal>
        )}

        {/* Cards */}
        {isAlternating ? (
          <div className="mt-12 space-y-20 lg:space-y-28">
            {cards.map((card, i) => (
              <AlternatingRowCard key={i} card={card} index={i} />
            ))}
          </div>
        ) : (
          <div className={`mt-12 grid gap-6 ${columnClasses[columns ?? 3]}`}>
            {cards.map((card, i) => {
              switch (cardStyle) {
                case 'info':
                  return <InfoCard key={i} card={card} index={i} />
                case 'imageOverlay':
                  return <ImageOverlayCard key={i} card={card} index={i} priority={priority} />
                case 'imageTop':
                  return <ImageTopCard key={i} card={card} index={i} priority={priority} />
                default:
                  return null
              }
            })}
          </div>
        )}
      </div>
    </section>
  )
}
