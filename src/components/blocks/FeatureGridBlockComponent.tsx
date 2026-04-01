import { ScrollReveal } from '@/components/ui/ScrollReveal'

interface FeatureItem {
  icon?: string | null
  title: string
  description?: string | null
}

interface FeatureGridBlockProps {
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  layout?: 'twoColumn' | 'threeColumn' | 'fourColumn' | null
  style?: 'iconTop' | 'iconLeft' | null
  items: FeatureItem[]
  accentColor?: string | null
}

const iconPaths: Record<string, string> = {
  smile:
    'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  graduation:
    'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5',
  coffee:
    'M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z',
  users:
    'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  heart:
    'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  music:
    'M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.34A1.125 1.125 0 0017.28 1.26l-6.405 1.831A1.125 1.125 0 009.75 4.21V15',
  book: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  chat: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  star: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  globe:
    'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418',
  shield:
    'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  rocket:
    'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z',
  sparkles:
    'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
}

function FeatureIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const path = iconPaths[name]
  if (!path) return null

  return (
    <svg
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

const columnClasses: Record<string, string> = {
  twoColumn: 'grid-cols-1 sm:grid-cols-2',
  threeColumn: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  fourColumn: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

export function FeatureGridBlockComponent({
  eyebrow,
  heading,
  description,
  layout: layoutProp,
  style: styleProp,
  items,
  accentColor,
}: FeatureGridBlockProps) {
  const layout = layoutProp ?? 'twoColumn'
  const style = styleProp ?? 'iconLeft'

  // Determine accent color for icon tinting
  const iconColorClass = accentColor ? undefined : 'text-rich-red'
  const iconColorStyle = accentColor ? { color: accentColor } : undefined
  const eyebrowColorClass = accentColor ? undefined : 'text-rich-red'
  const eyebrowColorStyle = accentColor ? { color: accentColor } : undefined

  if (style === 'iconLeft') {
    return (
      <section className="bg-warm-white px-5 py-16 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[80rem]">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            {/* Left: heading section — sticky */}
            <ScrollReveal>
              <div className="lg:sticky lg:top-32">
                {eyebrow && (
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.2em] ${eyebrowColorClass ?? ''}`}
                    style={eyebrowColorStyle}
                  >
                    {eyebrow}
                  </p>
                )}
                {heading && (
                  <h2 className="mt-3 text-h2 leading-heading text-brand-black">
                    {heading}
                  </h2>
                )}
                {description && (
                  <p className="mt-6 max-w-sm text-[0.9375rem] leading-relaxed text-dark-grey">
                    {description}
                  </p>
                )}
              </div>
            </ScrollReveal>

            {/* Right: items */}
            <div className="space-y-10">
              {items.map((item, i) => (
                <ScrollReveal key={i} delay={i * 80}>
                  <div className="flex items-start gap-5">
                    {item.icon && (
                      <FeatureIcon
                        name={item.icon}
                        className={`mt-1.5 h-7 w-7 shrink-0 ${iconColorClass ?? ''}`}
                        style={iconColorStyle}
                      />
                    )}
                    <div>
                      <h3 className="text-h3 text-brand-black">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-mid-grey">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  // iconTop style
  return (
    <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-[80rem]">
        {(eyebrow || heading || description) && (
          <ScrollReveal>
            <div className="text-center">
              {eyebrow && (
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.2em] ${eyebrowColorClass ?? ''}`}
                  style={eyebrowColorStyle}
                >
                  {eyebrow}
                </p>
              )}
              {heading && (
                <h2 className="mx-auto mt-3 max-w-2xl text-h2 leading-heading text-brand-black">
                  {heading}
                </h2>
              )}
              {description && (
                <p className="mx-auto mt-6 max-w-xl text-lg leading-body-lg text-dark-grey">
                  {description}
                </p>
              )}
            </div>
          </ScrollReveal>
        )}

        <div className={`mt-16 grid gap-8 ${columnClasses[layout]}`}>
          {items.map((item, i) => (
            <ScrollReveal key={i} delay={i * 100}>
              <div className="rounded-xl border border-warm-grey/60 bg-white p-8 text-center">
                {item.icon && (
                  <div
                    className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${accentColor ? '' : 'bg-light-red-3/30'}`}
                    style={accentColor ? { backgroundColor: `${accentColor}1a` } : undefined}
                  >
                    <FeatureIcon
                      name={item.icon}
                      className={`h-8 w-8 ${iconColorClass ?? ''}`}
                      style={iconColorStyle}
                    />
                  </div>
                )}
                <h3 className="mt-5 font-sans text-h4 font-bold text-brand-black">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="mt-3 text-[0.9375rem] leading-relaxed text-mid-grey">
                    {item.description}
                  </p>
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
