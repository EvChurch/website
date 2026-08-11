import { DailyReadingPromoClient } from '@/components/daily-readings/DailyReadingPromoClient'
import { formatReadingDate, getLatestDailyReading } from '@/lib/daily-readings/data'

export async function DailyReadingBlockComponent({
  eyebrow = 'A word from God for you today',
  heading = 'Make room for the word.',
}: {
  eyebrow?: string | null
  heading?: string | null
}) {
  const reading = await getLatestDailyReading()
  if (!reading) return null

  return (
    <section className="bg-warm-white px-5 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-[80rem]">
        <div className="grid overflow-hidden rounded-2xl border border-warm-grey bg-white shadow-[0_24px_80px_rgba(15,0,4,0.08)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative flex min-h-[23rem] flex-col justify-between overflow-hidden bg-brand-black p-7 text-white sm:p-10 lg:p-12">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full border-[45px] border-rich-red/20" aria-hidden="true" />
            <div className="relative">
              {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-hero-eyebrow">{eyebrow}</p>}
              {heading && <h2 className="mt-4 max-w-xl text-[clamp(2.25rem,5vw,4.5rem)] leading-[1] tracking-[-0.045em] text-warm-white">{heading}</h2>}
            </div>
            <blockquote className="relative mt-10 max-w-xl border-l-2 border-rich-red pl-5 font-serif text-xl leading-relaxed text-warm-white/80">
              {reading.openingScripture}
            </blockquote>
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rich-red">{formatReadingDate(reading.sourceDate, { weekday: true })}</p>
            <h3 className="mt-3 text-[clamp(2rem,4vw,3.75rem)] leading-tight text-brand-black">{reading.passageReference}</h3>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-mid-grey">
              Take a few quiet minutes to read today’s passage, reflect on what it means, and pray in response.
            </p>
            <DailyReadingPromoClient reading={reading} />
          </div>
        </div>
      </div>
    </section>
  )
}
