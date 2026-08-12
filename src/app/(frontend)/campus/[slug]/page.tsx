import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { RenderBlocks, type RenderableBlock } from '@/components/blocks/RenderBlocks'
import RichText from '@/components/blocks/RichTextRenderer'
import { BreadcrumbJsonLd, buildBreadcrumbs } from '@/components/seo/BreadcrumbJsonLd'
import { CampusJsonLd } from '@/components/seo/CampusJsonLd'
import { Button, type ButtonLinkAction } from '@/components/ui/Button'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { getGoogleMapsEmbedUrl } from '@/lib/google-maps'
import { getPayloadClient } from '@/lib/payload'
import type { Campus, Media } from '@/payload-types'

interface CampusImage {
  src: string
  alt: string
}

type CampusPageDocument = Pick<
  Campus,
  | 'id'
  | 'name'
  | 'slug'
  | 'address'
  | 'description'
  | 'featuredImage'
  | 'slideImages'
  | 'pageContent'
  | 'layout'
>

interface ManagedPageContent {
  brandName: string
  tagline: string
  locationLabel: string
  seoTitle?: string | null
  seoDescription?: string | null
  serviceDay: string
  serviceTimeLabel: string
  serviceOpens: string
  serviceCloses: string
  serviceDuration: string
  kidsProgram: boolean
  kidsAges?: string | null
  heroImagePath?: string | null
  galleryImages: CampusImage[]
  mapUrl: string
  parkingInfo: string
  actions: ButtonLinkAction[]
  ctaHeading: string
  ctaText: string
  ctaLabel: string
  ctaHref: string
}

interface ManagedCampusPage {
  campus: CampusPageDocument
  content: ManagedPageContent
}

interface BrandHeading {
  prefix: string | null
  highlight: string
}

export const dynamic = 'force-dynamic'

function asRequiredText(value: string | null | undefined): string | null {
  const text = value?.trim()
  return text ? text : null
}

function getBrandHeading(brandName: string): BrandHeading {
  const lastSpace = brandName.lastIndexOf(' ')
  if (lastSpace === -1) return { prefix: null, highlight: brandName }

  return {
    prefix: brandName.slice(0, lastSpace),
    highlight: brandName.slice(lastSpace + 1),
  }
}

function getManagedPageContent(campus: CampusPageDocument): ManagedPageContent | null {
  const page = campus.pageContent
  if (!page) return null

  const brandName = asRequiredText(page.brandName)
  const tagline = asRequiredText(page.tagline)
  const locationLabel = asRequiredText(page.locationLabel)
  const serviceDay = asRequiredText(page.serviceDay)
  const serviceTimeLabel = asRequiredText(page.serviceTimeLabel)
  const serviceOpens = asRequiredText(page.serviceOpens)
  const serviceCloses = asRequiredText(page.serviceCloses)
  const serviceDuration = asRequiredText(page.serviceDuration)
  const mapUrl = asRequiredText(page.mapUrl)
  const parkingInfo = asRequiredText(page.parkingInfo)
  const ctaHeading = asRequiredText(page.ctaHeading)
  const ctaText = asRequiredText(page.ctaText)
  const ctaLabel = asRequiredText(page.ctaLabel)
  const ctaHref = asRequiredText(page.ctaHref)

  if (
    !page.enabled ||
    !brandName ||
    !tagline ||
    !locationLabel ||
    !serviceDay ||
    !serviceTimeLabel ||
    !serviceOpens ||
    !serviceCloses ||
    !serviceDuration ||
    !mapUrl ||
    !parkingInfo ||
    !ctaHeading ||
    !ctaText ||
    !ctaLabel ||
    !ctaHref
  ) {
    return null
  }

  const galleryImages =
    page.galleryImages?.flatMap(({ src, alt }) => {
      const imageSrc = asRequiredText(src)
      const imageAlt = asRequiredText(alt)
      return imageSrc && imageAlt ? [{ src: imageSrc, alt: imageAlt }] : []
    }) ?? []
  const actions =
    page.actions?.flatMap(({ label, href, variant, external }) => {
      const actionLabel = asRequiredText(label)
      const actionHref = asRequiredText(href)
      return actionLabel && actionHref
        ? [
            {
              label: actionLabel,
              href: actionHref,
              variant: variant ?? undefined,
              external: external ?? undefined,
            },
          ]
        : []
    }) ?? []

  return {
    brandName,
    tagline,
    locationLabel,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    serviceDay,
    serviceTimeLabel,
    serviceOpens,
    serviceCloses,
    serviceDuration,
    kidsProgram: page.kidsProgram ?? false,
    kidsAges: page.kidsAges,
    heroImagePath: page.heroImagePath,
    galleryImages,
    mapUrl,
    parkingInfo,
    actions,
    ctaHeading,
    ctaText,
    ctaLabel,
    ctaHref,
  }
}

const getCampusBySlug = cache(async (slug: string): Promise<ManagedCampusPage | null> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'campuses',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    select: {
      name: true,
      slug: true,
      address: true,
      description: true,
      featuredImage: true,
      slideImages: true,
      pageContent: true,
      layout: true,
    },
  })

  const campus = result.docs[0]
  if (!campus) return null

  const content = getManagedPageContent(campus)
  return content ? { campus, content } : null
})

function getMediaImage(value: number | Media | null | undefined): CampusImage | null {
  if (!value || typeof value !== 'object' || !value.url) return null
  return { src: value.url, alt: value.alt }
}

function getHeroImage(
  campus: CampusPageDocument,
  content: ManagedPageContent,
): CampusImage | null {
  return (
    getMediaImage(campus.featuredImage) ??
    (content.heroImagePath
      ? {
          src: content.heroImagePath,
          alt: `${content.brandName} campus`,
        }
      : null)
  )
}

function getGalleryImages(campus: CampusPageDocument, content: ManagedPageContent): CampusImage[] {
  const uploadedImages =
    campus.slideImages
      ?.map(({ image }) => getMediaImage(image))
      .filter((image): image is CampusImage => image !== null) ?? []

  if (uploadedImages.length > 0) return uploadedImages
  return content.galleryImages
}

function getAddress(campus: CampusPageDocument): string {
  return [campus.address?.street, campus.address?.city, campus.address?.postalCode]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(', ')
}

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const managedCampus = await getCampusBySlug(slug)
  if (!managedCampus) return {}

  const { campus, content } = managedCampus
  const { brandName, locationLabel, serviceTimeLabel } = content
  const address = getAddress(campus) || locationLabel
  const title = asRequiredText(content.seoTitle) ?? `${campus.name} Campus | Ev Church Auckland`
  const description =
    asRequiredText(content.seoDescription) ??
    `Join ${brandName} at ${address}. Services every ${serviceTimeLabel}. A welcoming community in ${locationLabel}.`

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title: `${campus.name} Campus | Ev Church`,
      description: `Services every ${serviceTimeLabel} at ${locationLabel}. Everyone is welcome.`,
      url: `https://www.ev.church/campus/${slug}`,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: brandName,
      description: `${serviceTimeLabel} at ${locationLabel}.`,
    },
    alternates: {
      canonical: `https://www.ev.church/campus/${slug}`,
    },
  }
}

export default async function CampusPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const managedCampus = await getCampusBySlug(slug)
  if (!managedCampus) notFound()

  const { campus, content } = managedCampus
  const heroImage = getHeroImage(campus, content)
  const galleryImages = getGalleryImages(campus, content)
  const address = getAddress(campus) || content.locationLabel
  const mapEmbedUrl = getGoogleMapsEmbedUrl(
    content.mapUrl,
    address,
    process.env.GOOGLE_MAPS_API_KEY,
  )
  const blocks = (campus.layout ?? []) as unknown as RenderableBlock[]
  const brandHeading = getBrandHeading(content.brandName)

  return (
    <>
      <CampusJsonLd
        name={campus.name}
        brandName={content.brandName}
        slug={slug}
        streetAddress={campus.address?.street ?? ''}
        addressLocality={campus.address?.city ?? ''}
        serviceDay={content.serviceDay}
        serviceOpens={content.serviceOpens}
        serviceCloses={content.serviceCloses}
      />
      <BreadcrumbJsonLd items={buildBreadcrumbs(`/campus/${slug}`, `${campus.name} Campus`)} />

      <section className="relative flex min-h-[70vh] items-center overflow-hidden bg-brand-black">
        <div className="absolute inset-0">
          {heroImage && (
            <img
              src={heroImage.src}
              alt={heroImage.alt}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-black/80 via-brand-black/60 to-brand-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black/50 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-[80rem] px-5 py-32 lg:px-8 lg:py-40">
          <div className="max-w-2xl">
            <p
              className="animate-fade-in-up text-xs font-semibold uppercase tracking-[0.2em] text-light-red-2"
              style={{ animationDelay: '100ms' }}
            >
              {content.locationLabel}
            </p>
            <h1
              className="animate-fade-in-up mt-6 text-display leading-display text-white"
              style={{ animationDelay: '200ms' }}
            >
              {brandHeading.prefix && `${brandHeading.prefix} `}
              <span className="italic text-light-red-3">{brandHeading.highlight}</span>
            </h1>
            <p
              className="animate-fade-in-up mt-4 text-xl text-warm-grey/70"
              style={{ animationDelay: '300ms' }}
            >
              {content.tagline}
            </p>
            <div
              className="animate-fade-in-up mt-8 inline-flex items-center gap-3 rounded-lg bg-white/10 px-5 py-3 backdrop-blur-sm"
              style={{ animationDelay: '400ms' }}
            >
              <svg className="h-5 w-5 text-light-red-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-white">{content.serviceTimeLabel}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[80rem]">
          <div className="grid gap-16 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <ScrollReveal>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                  About this campus
                </p>
                <h2 className="mt-3 text-h2 leading-heading text-brand-black">
                  Welcome to {content.brandName}
                </h2>
                <div className="mt-6 text-lg leading-body-lg text-dark-grey">
                  <RichText data={campus.description} />
                </div>
                <div className="mt-8">
                  <Button href={content.ctaHref}>{content.ctaLabel}</Button>
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
                      <dd className="mt-1 text-dark-grey">{content.serviceTimeLabel}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-brand-black">Where</dt>
                      <dd className="mt-1">
                        <a
                          href="#campus-map"
                          className="font-medium text-rich-red underline decoration-rich-red/35 underline-offset-4 transition-colors hover:text-deep-red"
                        >
                          {address}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-brand-black">Duration</dt>
                      <dd className="mt-1 text-dark-grey">{content.serviceDuration}</dd>
                    </div>
                    {content.kidsProgram && content.kidsAges && (
                      <div>
                        <dt className="font-semibold text-brand-black">Kids program</dt>
                        <dd className="mt-1 text-dark-grey">{content.kidsAges}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {galleryImages.length > 0 && (
        <section className="bg-white px-5 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-[80rem]">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                Life at {content.brandName}
              </p>
              <h2 className="mt-3 text-h2 leading-heading text-brand-black">
                See what we are about
              </h2>
            </ScrollReveal>

            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {galleryImages.map((image, index) => (
                <ScrollReveal key={image.src} delay={index * 80}>
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
      )}

      <section id="campus-map" className="scroll-mt-24 bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[80rem]">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <ScrollReveal>
              <div className="overflow-hidden rounded-xl border border-warm-grey/60">
                <iframe
                  src={mapEmbedUrl}
                  title={`Map showing ${content.brandName}`}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  className="aspect-[4/3] w-full border-0"
                />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                Find us
              </p>
              <h2 className="mt-3 text-h2 leading-heading text-brand-black">Getting here</h2>
              <p className="mt-6 text-lg leading-body-lg text-dark-grey">{address}</p>
              <p className="mt-4 text-[0.9375rem] text-mid-grey">{content.parkingInfo}</p>
              {content.actions.length > 0 && (
                <div className="mt-8 flex flex-wrap gap-4">
                  {content.actions.map((action) => (
                    <Button
                      key={`${action.label}-${action.href}`}
                      href={action.href}
                      external={action.external ?? false}
                      variant={action.variant ?? 'text'}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </ScrollReveal>
          </div>
        </div>
      </section>

      <RenderBlocks blocks={blocks} />

      <section className="relative overflow-hidden bg-rich-red px-5 py-20 lg:px-8 lg:py-28">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />

        <div className="relative mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <h2 className="text-h1 leading-display text-white">{content.ctaHeading}</h2>
            <p className="mt-5 text-lg leading-body-lg text-white">{content.ctaText}</p>
            <div className="mt-10">
              <a
                href={content.ctaHref}
                className="inline-flex items-center justify-center rounded-md bg-white px-8 py-3.5 text-base font-semibold text-rich-red shadow-lg transition-all duration-200 hover:bg-warm-white hover:shadow-xl active:scale-[0.97]"
              >
                {content.ctaLabel}
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
