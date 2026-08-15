import { ScrollReveal } from '@/components/ui/ScrollReveal'

interface TimelineEvent {
  year: string
  title: string
  description?: string | null
}

interface TimelineBlockProps {
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  theme?: 'dark' | 'light' | null
  events: TimelineEvent[]
}

export function TimelineBlockComponent({
  eyebrow,
  heading,
  description,
  theme = 'dark',
  events,
}: TimelineBlockProps) {
  const isDark = theme === 'dark'

  return (
    <section
      className={`overflow-hidden px-5 py-24 lg:px-8 lg:py-32 ${isDark ? 'bg-brand-black' : 'bg-warm-white'}`}
    >
      <div className="mx-auto max-w-[80rem] px-5 lg:px-8">
        {/* Header */}
        {(eyebrow || heading || description) && (
          <ScrollReveal>
            <div className="mb-16">
              {eyebrow && (
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                    isDark ? 'text-light-red-2' : 'text-rich-red'
                  }`}
                >
                  {eyebrow}
                </p>
              )}
              {heading && (
                <h2
                  className={`mt-4 text-h2 leading-heading ${
                    isDark ? 'text-white' : 'text-brand-black'
                  }`}
                >
                  {heading}
                </h2>
              )}
              {description && (
                <p
                  className={`mt-4 max-w-2xl text-lg leading-relaxed ${
                    isDark ? 'text-warm-grey/70' : 'text-dark-grey'
                  }`}
                >
                  {description}
                </p>
              )}
            </div>
          </ScrollReveal>
        )}

        {/* Timeline: horizontal scroll on mobile, grid on desktop */}
        <div className="overflow-x-auto lg:overflow-visible">
          <div className="flex min-w-max gap-0 lg:grid lg:min-w-0 lg:grid-cols-6">
            {events.map((event, i) => (
              <ScrollReveal key={i} delay={i * 120}>
                <div
                  className={`min-w-[200px] px-4 lg:min-w-0 lg:px-0 lg:pr-8 ${
                    isDark
                      ? 'border-l border-warm-grey/20 lg:border-l-0 lg:border-t'
                      : 'border-l border-warm-grey/30 lg:border-l-0 lg:border-t'
                  } py-6 lg:pt-8`}
                >
                  <span className="font-sans text-[2.5rem] font-normal leading-none text-rich-red">
                    {event.year}
                  </span>
                  <h3
                    className={`mt-3 text-sm font-bold uppercase tracking-wide ${
                      isDark ? 'text-white' : 'text-brand-black'
                    }`}
                  >
                    {event.title}
                  </h3>
                  {event.description && (
                    <p
                      className={`mt-2 text-sm leading-relaxed ${
                        isDark ? 'text-warm-grey/60' : 'text-mid-grey'
                      }`}
                    >
                      {event.description}
                    </p>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
