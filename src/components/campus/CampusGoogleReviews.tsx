'use client'

import { useEffect, useRef, useState } from 'react'

import { TrackedButtonLink } from '@/components/analytics/TrackedLink'
import { Button } from '@/components/ui/Button'

interface GoogleLocalizedText {
  text?: string
}

interface GoogleAuthorAttribution {
  displayName?: string
  uri?: string
  photoUri?: string
}

interface GoogleReview {
  authorAttribution?: GoogleAuthorAttribution
  googleMapsUri?: string
  rating?: number
  relativePublishTimeDescription?: string
  text?: GoogleLocalizedText
}

interface GooglePlaceDetails {
  googleMapsUri?: string
  rating?: number
  reviews?: GoogleReview[]
  userRatingCount?: number
}

interface CampusGoogleReviewsProps {
  apiKey: string
  campusName: string
  campusSlug: string
  googleMapsUrl?: string
  placeId: string
  reviewUrl: string
}

function Stars({ rating }: { rating: number }) {
  const roundedRating = Math.round(rating)

  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={index < roundedRating ? 'text-[#F9AB00]' : 'text-warm-grey'}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  )
}

function ReviewCard({ review }: { review: GoogleReview }) {
  const author = review.authorAttribution
  const text = review.text?.text?.trim()
  if (!author?.displayName || !text) return null

  const initials = author.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <article className="flex h-full flex-col rounded-2xl border border-warm-grey/60 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        {author.photoUri ? (
          // Google supplies dynamic reviewer image hosts, so the standard image element is intentional.
          <img
            src={author.photoUri}
            alt=""
            className="h-11 w-11 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full bg-warm-white text-sm font-semibold text-rich-red"
            aria-hidden="true"
          >
            {initials}
          </span>
        )}
        <div className="min-w-0">
          {author.uri ? (
            <a
              href={author.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-black hover:text-rich-red"
            >
              {author.displayName}
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          ) : (
            <p className="font-semibold text-brand-black">{author.displayName}</p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-mid-grey">
            <Stars rating={review.rating ?? 0} />
            {review.relativePublishTimeDescription && (
              <span>{review.relativePublishTimeDescription}</span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-5 flex-1 leading-relaxed text-dark-grey">{text}</p>

      {review.googleMapsUri && (
        <a
          href={review.googleMapsUri}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 text-sm font-semibold text-rich-red hover:text-deep-red"
        >
          Read on Google Maps
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      )}
    </article>
  )
}

function ReviewPrompt({
  campusName,
  campusSlug,
  reviewUrl,
}: Pick<CampusGoogleReviewsProps, 'campusName' | 'campusSlug' | 'reviewUrl'>) {
  return (
    <div className="rounded-2xl border border-warm-grey/60 bg-white p-6 text-center shadow-sm sm:p-8">
      <h2 className="text-h3 leading-heading text-brand-black">Visited {campusName}?</h2>
      <div className="mt-5">
        <TrackedButtonLink
          href={reviewUrl}
          external
          variant="secondary"
          eventName="google_review_click"
          eventParameters={{ campus: campusSlug, destination_host: 'search.google.com' }}
        >
          Share your experience on Google
        </TrackedButtonLink>
      </div>
    </div>
  )
}

export function CampusGoogleReviews({
  apiKey,
  campusName,
  campusSlug,
  googleMapsUrl,
  placeId,
  reviewUrl,
}: CampusGoogleReviewsProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const [place, setPlace] = useState<GooglePlaceDetails | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || !apiKey || !placeId) return

    const abortController = new AbortController()
    let requested = false

    const loadReviews = async () => {
      if (requested) return
      requested = true

      try {
        const response = await fetch(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
          {
            headers: {
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': [
                'googleMapsUri',
                'rating',
                'userRatingCount',
                'reviews.authorAttribution',
                'reviews.googleMapsUri',
                'reviews.rating',
                'reviews.relativePublishTimeDescription',
                'reviews.text',
              ].join(','),
            },
            signal: abortController.signal,
          },
        )

        if (!response.ok) throw new Error(`Google Places request failed: ${response.status}`)

        const data = (await response.json()) as GooglePlaceDetails
        setPlace(data)
      } catch {
        if (!abortController.signal.aborted) setFailed(true)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          void loadReviews()
        }
      },
      { rootMargin: '300px' },
    )

    observer.observe(section)

    return () => {
      observer.disconnect()
      abortController.abort()
    }
  }, [apiKey, placeId])

  const reviews = place?.reviews?.filter((review) => review.text?.text?.trim()).slice(0, 3) ?? []
  const allReviewsUrl = place?.googleMapsUri ?? googleMapsUrl

  return (
    <section ref={sectionRef} className="bg-warm-white px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[80rem]">
        {failed || !apiKey || (place && reviews.length === 0) ? (
          <ReviewPrompt campusName={campusName} campusSlug={campusSlug} reviewUrl={reviewUrl} />
        ) : place && reviews.length > 0 ? (
          <>
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                  Google reviews
                </p>
                <h2 className="mt-3 text-h2 leading-heading text-brand-black">
                  What people say about {campusName}
                </h2>
              </div>
              {typeof place.rating === 'number' && (
                <div className="shrink-0 sm:text-right">
                  <div className="flex items-center gap-3 sm:justify-end">
                    <span className="text-3xl font-semibold text-brand-black">
                      {place.rating.toFixed(1)}
                    </span>
                    <Stars rating={place.rating} />
                  </div>
                  {typeof place.userRatingCount === 'number' && (
                    <p className="mt-1 text-sm text-mid-grey">
                      {place.userRatingCount.toLocaleString('en-NZ')} Google reviews
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {reviews.map((review, index) => (
                <ReviewCard
                  key={review.googleMapsUri ?? `${review.authorAttribution?.displayName}-${index}`}
                  review={review}
                />
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              {allReviewsUrl && (
                <Button href={allReviewsUrl} external variant="secondary">
                  Read all reviews
                </Button>
              )}
              <TrackedButtonLink
                href={reviewUrl}
                external
                eventName="google_review_click"
                eventParameters={{ campus: campusSlug, destination_host: 'search.google.com' }}
              >
                Share your experience
              </TrackedButtonLink>
              {allReviewsUrl && (
                <a
                  href={allReviewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  translate="no"
                  className="ml-auto text-base text-[#5F6368] hover:text-brand-black"
                  style={{ fontFamily: 'Roboto, Arial, sans-serif' }}
                >
                  Google Maps
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              )}
            </div>
          </>
        ) : (
          <div>
            <div className="animate-pulse" aria-label="Loading Google reviews">
              <div className="h-3 w-28 rounded bg-warm-grey" />
              <div className="mt-4 h-10 max-w-xl rounded bg-warm-grey/70" />
              <div className="mt-10 grid gap-5 md:grid-cols-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="h-64 rounded-2xl bg-white shadow-sm" />
                ))}
              </div>
            </div>
            <div className="mt-10">
              <TrackedButtonLink
                href={reviewUrl}
                external
                eventName="google_review_click"
                eventParameters={{ campus: campusSlug, destination_host: 'search.google.com' }}
              >
                Share your experience on Google
              </TrackedButtonLink>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
