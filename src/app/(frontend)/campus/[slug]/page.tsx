import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button, ArrowRight } from '@/components/ui/Button'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { CampusJsonLd } from '@/components/seo/CampusJsonLd'
import { BreadcrumbJsonLd, buildBreadcrumbs } from '@/components/seo/BreadcrumbJsonLd'

interface CampusData {
  name: string
  /** Full branded name, e.g. "Ev Central" or "Unichurch" */
  brandName: string
  tagline: string
  time: string
  location: string
  address: string
  streetAddress: string
  addressLocality: string
  serviceOpens: string
  serviceCloses: string
  description: string
  heroImage: string
  galleryImages: { src: string; alt: string }[]
  mapPlaceholder: string
  kidsProgram: boolean
}

const campusData: Record<string, CampusData> = {
  central: {
    name: 'Central',
    brandName: 'Ev Central',
    tagline: 'In the heart of the city',
    time: 'Sunday 10:15 am',
    location: 'Hillsborough, Auckland',
    address: '80 Olsen Avenue, Hillsborough, Auckland',
    streetAddress: '80 Olsen Avenue',
    addressLocality: 'Hillsborough',
    serviceOpens: '10:15',
    serviceCloses: '11:30',
    description:
      'Ev Central meets in Hillsborough, south-central Auckland. We are a diverse, vibrant community of people from all walks of life. Whether you live nearby or are visiting, you are welcome here. Our Sunday services feature live worship, an engaging message, and genuine community.',
    heroImage: '/images/campus-central/photo-3b4be562.jpg',
    galleryImages: [
      { src: '/images/campus-central/photo-9018bc8d.jpg', alt: 'Live worship at Ev Church Central campus in Hillsborough Auckland' },
      { src: '/images/campus-central/photo-c1a8d4f7.jpg', alt: 'Community gathering at Ev Church Central Auckland' },
      { src: '/images/campus-central/photo-e85b8b0f.jpg', alt: 'People connecting at Ev Church Central Hillsborough' },
      { src: '/images/campus-central/photo-f38f53fe.jpg', alt: 'Sunday service gathering at Ev Church Central Auckland' },
    ],
    mapPlaceholder: 'https://www.google.com/maps?q=80+Olsen+Avenue+Hillsborough+Auckland',
    kidsProgram: true,
  },
  unichurch: {
    name: 'Unichurch',
    brandName: 'Unichurch',
    tagline: 'Faith on campus',
    time: 'Sunday 5:15 pm',
    location: 'University of Auckland',
    address: 'University of Auckland, 24 Princes Street, Auckland 1010',
    streetAddress: '24 Princes Street',
    addressLocality: 'Auckland CBD',
    serviceOpens: '17:15',
    serviceCloses: '18:30',
    description:
      'Unichurch is our campus expression specifically for university students. Meeting on Sunday evenings, it is the perfect way to end your weekend and start your week. If you are a student at the University of Auckland or any tertiary institution in the city, this is your community. Expect relaxed vibes, real conversations, and a space to explore faith.',
    heroImage: '/images/campus-unichurch/photo-3cb597b9.jpg',
    galleryImages: [
      { src: '/images/campus-unichurch/photo-4e451abd.jpg', alt: 'University students at Unichurch Auckland' },
      { src: '/images/campus-unichurch/photo-af1c0355.jpg', alt: 'Worship at Unichurch student church Auckland' },
      { src: '/images/campus-unichurch/photo-be476efc.jpg', alt: 'Student community at Unichurch University of Auckland' },
      { src: '/images/campus-unichurch/photo-d912efee.jpg', alt: 'Sunday evening gathering at Unichurch Auckland' },
    ],
    mapPlaceholder: 'https://www.google.com/maps?q=24+Princes+Street+Auckland',
    kidsProgram: false,
  },
  north: {
    name: 'North',
    brandName: 'Ev North',
    tagline: 'Community on the Shore',
    time: 'Sunday 10:15 am',
    location: 'Rosedale, Auckland',
    address: '9-11 Rothwell Avenue, Rosedale, Auckland',
    streetAddress: '9-11 Rothwell Avenue',
    addressLocality: 'Rosedale',
    serviceOpens: '10:15',
    serviceCloses: '11:30',
    description:
      'Ev North is located in Rosedale on the North Shore, serving families and individuals across the wider Shore community. We are a warm, welcoming church with a heart for people at every stage of life. Our services are relaxed and family-friendly, with excellent programs for kids of all ages.',
    heroImage: '/images/homepage/carousel-c645786c.jpg',
    galleryImages: [
      { src: '/images/homepage/carousel-3c68ddf1.jpg', alt: 'Families at Ev Church North campus Rosedale Auckland' },
      { src: '/images/homepage/carousel-168f386e.jpg', alt: 'Community at Ev Church North Shore Auckland' },
      { src: '/images/homepage/carousel-9a8d8943.jpg', alt: 'Live worship at Ev Church North Rosedale Auckland' },
      { src: '/images/homepage/carousel-70ac2785.jpg', alt: 'Sunday gathering at Ev Church North campus Auckland' },
    ],
    mapPlaceholder: 'https://www.google.com/maps?q=9-11+Rothwell+Avenue+Rosedale+Auckland',
    kidsProgram: true,
  },
}

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const campus = campusData[slug]
  if (!campus) return {}

  const isUnichurch = slug === 'unichurch'
  const title = isUnichurch
    ? 'Unichurch | Student Church Auckland | University of Auckland'
    : `${campus.name} Campus | Ev Church Auckland`
  const description = isUnichurch
    ? 'Join Unichurch at the University of Auckland. A student church for university and tertiary students in Auckland. Sunday 5:15 pm.'
    : `Join ${campus.brandName} at ${campus.address}. Services every ${campus.time}. A welcoming community in ${campus.location}.`

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title: `${campus.name} Campus | Ev Church`,
      description: `Services every ${campus.time} at ${campus.location}. Everyone is welcome.`,
      url: `https://ev.church/campus/${slug}`,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${campus.brandName}`,
      description: `${campus.time} at ${campus.location}.`,
    },
    alternates: {
      canonical: `https://ev.church/campus/${slug}`,
    },
  }
}

export default async function CampusPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const campus = campusData[slug]

  if (!campus) {
    notFound()
  }

  return (
    <>
      <CampusJsonLd
        name={campus.name}
        brandName={campus.brandName}
        slug={slug}
        streetAddress={campus.streetAddress}
        addressLocality={campus.addressLocality}
        serviceDay="Sunday"
        serviceOpens={campus.serviceOpens}
        serviceCloses={campus.serviceCloses}
      />
      <BreadcrumbJsonLd items={buildBreadcrumbs(`/campus/${slug}`, `${campus.name} Campus`)} />

      {/* Hero */}
      <section className="relative flex min-h-[70vh] items-center overflow-hidden bg-brand-black">
        <div className="absolute inset-0">
          <img
            src={campus.heroImage}
            alt={`${campus.brandName} campus`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-black/80 via-brand-black/60 to-brand-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black/50 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-[80rem] px-5 py-32 lg:px-8 lg:py-40">
          <div className="max-w-2xl">
            <p
              className="animate-fade-in-up text-xs font-semibold uppercase tracking-[0.2em] text-warm-white/70"
              style={{ animationDelay: '100ms' }}
            >
              {campus.location}
            </p>
            <h1
              className="animate-fade-in-up mt-6 text-display leading-display text-white"
              style={{ animationDelay: '200ms' }}
            >
              Ev{' '}
              <span className="italic text-warm-white">{campus.name}</span>
            </h1>
            <p
              className="animate-fade-in-up mt-4 text-xl text-warm-grey/70"
              style={{ animationDelay: '300ms' }}
            >
              {campus.tagline}
            </p>
            <div
              className="animate-fade-in-up mt-8 inline-flex items-center gap-3 rounded-lg bg-white/10 px-5 py-3 backdrop-blur-sm"
              style={{ animationDelay: '400ms' }}
            >
              <svg className="h-5 w-5 text-warm-white/80" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-white">{campus.time}</span>
            </div>
          </div>
        </div>

      </section>

      {/* Description + Service Info */}
      <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[80rem]">
          <div className="grid gap-16 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <ScrollReveal>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                  About this campus
                </p>
                <h2 className="mt-3 text-h2 leading-heading text-brand-black">
                  Welcome to {campus.brandName}
                </h2>
                <p className="mt-6 text-lg leading-body-lg text-dark-grey">
                  {campus.description}
                </p>
                <div className="mt-8">
                  <Button href="/visit">Plan your visit</Button>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-2">
              <ScrollReveal delay={100}>
                <div className="rounded-xl border border-warm-grey/60 bg-white p-8">
                  <h3 className="font-sans text-sm font-semibold uppercase tracking-[0.15em] text-rich-red">
                    Service details
                  </h3>
                  <dl className="mt-6 space-y-5 text-[0.9375rem]">
                    <div>
                      <dt className="font-semibold text-brand-black">When</dt>
                      <dd className="mt-1 text-dark-grey">{campus.time}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-brand-black">Where</dt>
                      <dd className="mt-1 text-dark-grey">{campus.address}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-brand-black">Duration</dt>
                      <dd className="mt-1 text-dark-grey">Approximately 75 minutes</dd>
                    </div>
                    {campus.kidsProgram && (
                      <div>
                        <dt className="font-semibold text-brand-black">Kids program</dt>
                        <dd className="mt-1 text-dark-grey">Available for ages 1 to 12</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* Image Gallery */}
      <section className="bg-white px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[80rem]">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
              Life at {campus.brandName}
            </p>
            <h2 className="mt-3 text-h2 leading-heading text-brand-black">
              See what we are about
            </h2>
          </ScrollReveal>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {campus.galleryImages.map((image, i) => (
              <ScrollReveal key={image.src} delay={i * 80}>
                <div className="overflow-hidden rounded-lg">
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Map Placeholder + Address */}
      <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[80rem]">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <ScrollReveal>
              <div className="overflow-hidden rounded-xl border border-warm-grey/60">
                {/* Google Maps embed placeholder */}
                <div className="flex aspect-[4/3] items-center justify-center bg-warm-grey/20">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-mid-grey" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <p className="mt-3 text-sm text-mid-grey">
                      Google Maps embed will be placed here
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                Find us
              </p>
              <h2 className="mt-3 text-h2 leading-heading text-brand-black">
                Getting here
              </h2>
              <p className="mt-6 text-lg leading-body-lg text-dark-grey">
                {campus.address}
              </p>
              <p className="mt-4 text-[0.9375rem] text-mid-grey">
                Parking is available on site. If you need any help finding us,
                feel free to get in touch.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href={campus.mapPlaceholder}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md bg-rich-red px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-deep-red hover:shadow-md active:scale-[0.97]"
                >
                  Get directions
                </a>
                <Button href="/contact" variant="text">
                  Contact us
                  <ArrowRight />
                </Button>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative overflow-hidden bg-rich-red px-5 py-20 lg:px-8 lg:py-28">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />

        <div className="relative mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <h2 className="text-h1 leading-display text-white">
              See you this Sunday
            </h2>
            <p className="mt-5 text-lg leading-body-lg text-warm-white/90">
              We would love to welcome you to {campus.brandName}.
              Come as you are. Everyone has a place here.
            </p>
            <div className="mt-10">
              <a
                href="/visit"
                className="inline-flex items-center justify-center rounded-md bg-white px-8 py-3.5 text-base font-semibold text-rich-red shadow-lg transition-all duration-200 hover:bg-warm-white hover:shadow-xl active:scale-[0.97]"
              >
                Plan your visit
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
