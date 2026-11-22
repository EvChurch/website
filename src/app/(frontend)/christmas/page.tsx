import type { Metadata } from 'next'
import Image from 'next/image'
import { ChristmasShare } from '@/components/christmas/ChristmasShare'

const title = 'Christmas 2026 at Ev Church'
const description = 'Come see what Christmas brings. Join us on 13, 20, 25 & 27 December at Ev Central, Ev North or Unichurch in Auckland. Everyone is welcome.'
const images = [{ url: 'https://www.ev.church/christmas/christmas-2026-social.jpg', secureUrl: 'https://www.ev.church/christmas/christmas-2026-social.jpg', type: 'image/jpeg', width: 1200, height: 630, alt: 'Come see what Christmas brings — Christmas 2026 at Ev Church' }]

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

const shareImages = [
  { id: 'invitation', label: 'Christmas invitation', alt: 'The best gift doesn’t fit under the tree. Come along to Ev Church this December and find what Christmas truly brings.' },
  { id: 'central', label: 'Ev Central service details', alt: 'Christmas services at Ev Central, 80 Olsen Ave, Hillsborough: 13, 20, 25 and 27 December at 10:15am.' },
  { id: 'north', label: 'Ev North service details', alt: 'Christmas services at Ev North, 9–11 Rothwell Ave, Rosedale: 13, 20, 25 and 27 December at 10:15am.' },
  { id: 'unichurch', label: 'Unichurch service details', alt: 'Unichurch Christmas services: 13, 20 and 27 December at 5:15pm at Maclaurin Chapel, and Christmas Day at 10:15am at Ev Central.' },
]

export default function ChristmasPage() {
  return (
    <div className="bg-[#0b203b] pb-20 pt-24 text-warm-white lg:pt-28">
      <section aria-label="Christmas at Ev Church" className="mx-auto max-w-[80rem] px-5 lg:px-8">
        <div className="relative overflow-hidden rounded-t-full border border-[#d9b879]/50 bg-[#102943] px-3 pb-14 pt-8 text-center sm:hidden">
          <Image src="/christmas/star.webp" alt="" width={96} height={96} className="mx-auto mb-6 h-24 w-24" />
          <h1 id="christmas-title" className="relative z-10">
            <span className="block font-serif text-3xl italic text-[#f3d49b]">Come see what</span>
            <span className="mt-2 block text-[clamp(2.25rem,10vw,4rem)] font-light uppercase leading-tight tracking-wide text-[#f3d49b]">Christmas</span>
            <span className="mt-1 block font-serif text-5xl italic text-[#f3d49b]">brings</span>
            <span className="sr-only"> — Christmas 2026 at Ev Church</span>
          </h1>
          <Image src="/christmas/angel.webp" alt="" width={72} height={90} className="absolute bottom-4 left-3 h-20 w-auto opacity-70" />
          <Image src="/christmas/angel.webp" alt="" width={72} height={90} className="absolute bottom-4 right-3 h-20 w-auto -scale-x-100 opacity-70" />
        </div>
        <h1 className="sr-only hidden sm:block">Come see what Christmas brings — Christmas 2026 at Ev Church</h1>
        <Image
          src="/christmas/christmas-2026.webp"
          alt="Come see what Christmas brings"
          width={1920}
          height={1080}
          sizes="(max-width: 1280px) 100vw, 1280px"
          preload
          className="hidden h-auto w-full sm:block"
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

      <section id="share" aria-labelledby="share-title" className="mx-auto mt-16 max-w-[80rem] scroll-mt-28 border-t border-[#d9b879]/40 px-5 pt-12 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="share-title" className="text-3xl font-bold sm:text-4xl">Share Christmas with a friend</h2>
          <p className="mt-4 text-lg leading-relaxed text-white/85">Invite a friend in a few taps. Choose a social app to share the Christmas page, or share an invitation image below.</p>
          <div className="mt-6"><ChristmasShare /></div>
        </div>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {shareImages.map((item) => {
            const src = `/christmas/share/ev-christmas-2026-${item.id}.jpg`
            return (
              <figure key={item.id}>
                <div className="overflow-hidden rounded-xl border border-[#d9b879]/40">
                  <Image src={src} alt={item.alt} width={2324} height={1682} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 608px" className="h-auto w-full" />
                </div>
                <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{item.label}</h3>
                  <ChristmasShare image={src} label={`Share ${item.label}`} />
                </figcaption>
              </figure>
            )
          })}
        </div>
        <p className="mt-8 text-center text-base leading-relaxed text-white/85">You can also send a friend this link: <a href="https://www.ev.church/christmas" className="font-semibold text-[#f3d49b] underline underline-offset-4">ev.church/christmas</a></p>
      </section>
    </div>
  )
}
