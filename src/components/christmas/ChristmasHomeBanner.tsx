import Image from 'next/image'
import Link from 'next/link'

export function ChristmasHomeBanner() {
  return (
    <section aria-labelledby="christmas-home-title" className="border-y border-[#d9b879]/40 bg-[#0b203b] px-5 py-12 text-warm-white lg:px-8 lg:py-16">
      <div className="mx-auto grid max-w-[80rem] items-center gap-8 md:grid-cols-[1.2fr_1fr] lg:gap-14">
        <Link href="/christmas" aria-label="Christmas at Ev Church" className="overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3d49b]">
          <Image src="/christmas/christmas-2026.webp" alt="Come see what Christmas brings" width={1920} height={1080} sizes="(max-width: 768px) 100vw, (max-width: 1280px) 55vw, 670px" className="h-auto w-full" />
        </Link>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f3d49b]">Christmas at Ev Church</p>
          <h2 id="christmas-home-title" className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">The best gift doesn’t fit under the tree.</h2>
          <p className="mt-5 text-lg leading-relaxed text-white/85">Bring a friend and discover the joy, comfort, life and hope that Jesus brings. Celebrate with us at Ev Central, Ev North or Unichurch.</p>
          <p className="mt-4 font-semibold text-[#f3d49b]">13, 20, 25 &amp; 27 December</p>
          <Link href="/christmas" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#d9b879] px-6 py-3 font-semibold text-[#0b203b] transition-colors hover:bg-[#f3d49b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3d49b]">Find a Christmas service</Link>
        </div>
      </div>
    </section>
  )
}
