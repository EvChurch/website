import type { Metadata } from 'next'
import Image from 'next/image'

const title = 'Christmas 2026 at Ev Church'
const description = 'Come see what Christmas brings. Discover joy, comfort, life and hope this December at Ev Central, Ev North and Unichurch in Auckland.'
const images = [{ url: '/christmas/christmas-2026.webp', width: 1920, height: 1080, alt: 'Come see what Christmas brings' }]

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: 'https://www.ev.church/christmas' },
  openGraph: {
    title,
    description,
    url: 'https://www.ev.church/christmas',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
    images,
  },
  twitter: { card: 'summary_large_image', title, description, images },
}

const dates = [
  { day: '13', weekday: 'Sunday', theme: 'Joy', familyTitle: 'Family Christmas Celebration', uniTitle: 'Christmas Celebration Sunday + Potluck' },
  { day: '20', weekday: 'Sunday', theme: 'Comfort', familyTitle: 'Family Christmas Sunday', uniTitle: 'Christmas Sunday Service' },
  { day: '25', weekday: 'Friday', theme: 'Life', familyTitle: 'Christmas Day Service', uniTitle: 'Christmas Day Service' },
  { day: '27', weekday: 'Sunday', theme: 'Hope', familyTitle: 'Sunday Service', uniTitle: 'Sunday Service' },
]

const campuses = [
  { id: 'central', name: 'Ev Central', address: '80 Olsen Ave, Hillsborough', mapQuery: 'Ev Church Central, 80 Olsen Ave, Hillsborough, Auckland', unichurch: false },
  { id: 'north', name: 'Ev North', address: '9–11 Rothwell Ave, Rosedale', mapQuery: 'Ev Church North, 9-11 Rothwell Ave, Rosedale, Auckland', unichurch: false },
  { id: 'unichurch', name: 'Unichurch', address: 'Maclaurin Chapel, Auckland University', mapQuery: 'Maclaurin Chapel, University of Auckland', unichurch: true },
]

const buttonClass = 'inline-flex min-h-12 items-center justify-center rounded-full border border-[#d9b879] px-6 py-3 text-base font-semibold text-[#f3d49b] transition-colors hover:bg-[#d9b879] hover:text-[#0b203b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3d49b]'

export default function ChristmasPage() {
  return (
    <div className="bg-[#0b203b] pb-20 pt-24 text-warm-white lg:pt-28">
      <section aria-labelledby="christmas-title" className="mx-auto max-w-[80rem] px-5 lg:px-8">
        <h1 id="christmas-title" className="sr-only">Come see what Christmas brings — Christmas 2026 at Ev Church</h1>
        <Image
          src="/christmas/christmas-2026.webp"
          alt="Come see what Christmas brings"
          width={1920}
          height={1080}
          sizes="(max-width: 1280px) 100vw, 1280px"
          preload
          className="h-auto w-full"
        />
        <div className="mx-auto max-w-3xl py-10 text-center sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f3d49b]">December 2026 · Auckland</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">The best gift doesn’t fit under the tree.</h2>
          <p className="mt-6 text-lg leading-relaxed text-white/85">What if Christmas brings more than we could ever imagine? Bring the whole family and discover how the birth of Jesus brings joy, comfort, life and hope — and why that changes everything!</p>
          <a href="#services" className={`${buttonClass} mt-8`}>Find a Christmas service</a>
        </div>
      </section>

      <section id="services" aria-labelledby="services-title" className="mx-auto max-w-[80rem] scroll-mt-28 px-5 lg:px-8">
        <div className="border-t border-[#d9b879]/40 py-10 text-center">
          <h2 id="services-title" className="text-3xl font-bold sm:text-4xl">Celebrate with us</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/85">Bring your kids, the grandparents and even your neighbours, or just come along with a friend. Everyone is welcome.</p>
          <nav aria-label="Christmas campuses" className="mt-6 flex flex-wrap justify-center gap-3">
            {campuses.map((campus) => <a key={campus.id} href={`#${campus.id}`} className={buttonClass}>{campus.name}</a>)}
          </nav>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {campuses.map((campus) => (
            <section key={campus.id} id={campus.id} aria-labelledby={`${campus.id}-title`} className="scroll-mt-28 rounded-2xl border border-[#d9b879]/40 bg-[#102943] p-6 sm:p-8">
              <h3 id={`${campus.id}-title`} className="text-3xl font-bold">{campus.name}</h3>
              <p className="mt-3 min-h-14 text-base leading-relaxed text-white/85">{campus.address}</p>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(campus.mapQuery)}`} className="mt-3 inline-block text-base font-semibold text-[#f3d49b] underline decoration-[#d9b879]/60 underline-offset-4 hover:decoration-[#f3d49b]">Get directions to {campus.name}</a>
              <ol className="mt-8 divide-y divide-[#d9b879]/30 border-y border-[#d9b879]/30">
                {dates.map((date) => {
                  const christmasAtCentral = campus.unichurch && date.day === '25'
                  const time = campus.unichurch && !christmasAtCentral ? '5:15pm' : '10:15am'
                  return (
                    <li key={date.day} className="py-6">
                      <time dateTime={`2026-12-${date.day}T${time === '5:15pm' ? '17' : '10'}:15:00+13:00`} className="text-sm font-semibold uppercase tracking-wider text-white/75">{date.weekday} {date.day} December · {time}</time>
                      <h4 className="mt-2 font-serif text-4xl italic text-[#f3d49b]">{date.theme}</h4>
                      <p className="mt-2 text-lg font-semibold leading-snug">{campus.unichurch ? date.uniTitle : date.familyTitle}</p>
                      {christmasAtCentral && <p className="mt-2 text-base text-[#f3d49b]">At Ev Central, 80 Olsen Ave, Hillsborough</p>}
                    </li>
                  )
                })}
              </ol>
              {campus.unichurch && <p className="mt-5 text-base leading-relaxed text-white/85">On Christmas Day, join us at <a href="#central" className="font-semibold text-[#f3d49b] underline underline-offset-4">Ev Central</a> at 10:15am. All other services above meet at Maclaurin Chapel at 5:15pm.</p>}
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}
