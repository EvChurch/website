import { ScrollReveal } from '@/components/ui/ScrollReveal'

interface StatItem {
  label: string
  stat: string
  statLabel: string
  description: string
  scripture?: string | null
  scriptureReference?: string | null
}

interface StatsGridBlockProps {
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  items: StatItem[]
}

export function StatsGridBlockComponent({
  eyebrow,
  heading,
  description,
  items,
}: StatsGridBlockProps) {
  return (
    <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-[80rem] px-5 lg:px-8">
        {/* Header */}
        {(eyebrow || heading || description) && (
          <ScrollReveal>
            <div className="mb-16 text-center">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                  {eyebrow}
                </p>
              )}
              {heading && (
                <h2 className="mt-4 text-h2 leading-heading text-brand-black">
                  {heading}
                </h2>
              )}
              {description && (
                <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-dark-grey">
                  {description}
                </p>
              )}
            </div>
          </ScrollReveal>
        )}

        {/* Stat cards */}
        <div className="space-y-8">
          {items.map((item, i) => (
            <ScrollReveal key={i} delay={i * 100}>
              <div className="overflow-hidden rounded-xl border border-warm-grey/60 bg-white">
                <div className="grid h-full grid-cols-1 lg:min-h-[280px] lg:grid-cols-[280px_1fr]">
                  {/* Dark stat panel — stretches to full card height via grid */}
                  <div className="flex flex-col items-center justify-center bg-brand-black px-8 py-10 text-center lg:py-12">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-white/70">
                      {item.label}
                    </p>
                    <p className="mt-3 font-serif text-[3.5rem] leading-none text-white">
                      {item.stat}
                    </p>
                    <p className="mt-2 text-sm text-warm-grey/70">{item.statLabel}</p>
                  </div>

                  {/* Description panel */}
                  <div className="flex flex-col justify-center bg-white px-8 py-10 lg:px-12 lg:py-12">
                    <p className="text-lg leading-relaxed text-dark-grey">{item.description}</p>
                    {item.scripture && (
                      <blockquote className="mt-6 border-l-2 border-rich-red pl-4">
                        <p className="text-sm italic leading-relaxed text-mid-grey">
                          {item.scripture}
                        </p>
                        {item.scriptureReference && (
                          <cite className="mt-2 block text-xs font-semibold not-italic uppercase tracking-wide text-rich-red">
                            {item.scriptureReference}
                          </cite>
                        )}
                      </blockquote>
                    )}
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
