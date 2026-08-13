'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { MediaImage } from '@/components/media/MediaImage'
import type { PayloadMediaImage } from '@/lib/payload-media'
import { Button } from '@/components/ui/Button'

type MediaRef = PayloadMediaImage & { id: string }

type Media = MediaRef | string

interface StepItem {
  stepTitle: string
  heading: string
  body?: unknown
  image?: Media | null
  imagePosition?: 'left' | 'right' | 'background' | null
  id?: string
}

interface CTAButton {
  label: string
  href: string
  variant?: 'primary' | 'secondary'
  id?: string
}

interface FinalCTA {
  heading?: string | null
  text?: string | null
  buttons?: CTAButton[] | null
}

interface GospelStepperBlockProps {
  heading?: string | null
  steps: StepItem[]
  finalCTA?: FinalCTA | null
}

/** Simple inline rich text renderer for client component context. */
function renderRichText(data: unknown): React.ReactNode {
  if (!data) return null
  if (typeof data === 'string') return <p>{data}</p>

  const lexical = data as { root?: { children?: Array<{ type: string; children?: Array<{ text?: string; type: string }> }> } }
  if (!lexical.root?.children) return null

  return lexical.root.children.map((node, i) => {
    if (node.type === 'paragraph') {
      const text = node.children?.map((c) => c.text ?? '').join('') ?? ''
      return <p key={i} className="mb-4 last:mb-0">{text}</p>
    }
    return null
  })
}

export function GospelStepperBlockComponent({
  heading,
  steps,
  finalCTA,
}: GospelStepperBlockProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)

  const totalSteps = steps.length
  const isLastStep = currentStep === totalSteps - 1
  const showFinalCTA = isLastStep && finalCTA?.heading

  const goTo = useCallback((index: number) => {
    setCurrentStep(Math.max(0, Math.min(index, totalSteps - 1)))
  }, [totalSteps])

  const goNext = useCallback(() => goTo(currentStep + 1), [currentStep, goTo])
  const goPrev = useCallback(() => goTo(currentStep - 1), [currentStep, goTo])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }

    const el = containerRef.current
    if (!el) return

    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev])

  // Touch/swipe support
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0) goNext()
      else goPrev()
    }
  }

  const step = steps[currentStep]
  const imageUrl = step.image ? (typeof step.image === 'string' ? step.image : step.image.url) : null
  const imagePos = step.imagePosition ?? 'right'

  return (
    <section className="bg-white px-5 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-[80rem]">
        {heading && (
          <h2 className="mb-12 text-center font-serif text-h2 font-normal leading-heading text-brand-black">
            {heading}
          </h2>
        )}

        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2" role="tablist" aria-label="Gospel presentation steps">
          {steps.map((s, i) => (
            <button
              key={s.id ?? i}
              type="button"
              role="tab"
              aria-selected={i === currentStep}
              aria-label={`Step ${i + 1}: ${s.stepTitle}`}
              onClick={() => goTo(i)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                i === currentStep
                  ? 'bg-rich-red text-white'
                  : i < currentStep
                    ? 'bg-light-red-1/20 text-rich-red'
                    : 'bg-warm-grey/30 text-mid-grey'
              }`}
            >
              <span className="hidden sm:inline">{s.stepTitle}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
          ))}
        </div>

        {/* Step counter */}
        <p className="mb-8 text-center text-sm text-mid-grey" aria-live="polite">
          Step {currentStep + 1} of {totalSteps}
        </p>

        {/* Step content */}
        <div
          ref={containerRef}
          tabIndex={0}
          role="group"
          aria-label="Gospel presentation"
          aria-roledescription="step"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-4 rounded-lg"
        >
          <div className="relative overflow-hidden">
            <div
              className="transition-all duration-500 ease-out"
              style={{ opacity: 1 }}
              key={currentStep}
            >
              {imagePos === 'background' && imageUrl ? (
                /* Background image layout */
                <div className="relative flex min-h-[400px] items-center overflow-hidden rounded-2xl bg-brand-black lg:min-h-[500px]">
                  <MediaImage
                    media={step.image!}
                    mediaSize="hero"
                    fill
                    sizes="(max-width: 768px) 100vw, 80rem"
                    className="object-cover opacity-40"
                  />
                  <div className="relative mx-auto max-w-2xl px-8 py-16 text-center">
                    <h3 className="font-serif text-h1 font-normal leading-display text-white">
                      {step.heading}
                    </h3>
                    <div className="mt-6 text-lg leading-body-lg text-white/80">
                      {renderRichText(step.body)}
                    </div>
                  </div>
                </div>
              ) : (
                /* Side-by-side layout */
                <div className={`flex flex-col items-center gap-8 lg:gap-16 ${
                  imageUrl ? (imagePos === 'left' ? 'lg:flex-row-reverse' : 'lg:flex-row') : ''
                }`}>
                  <div className={`flex-1 ${imageUrl ? '' : 'mx-auto max-w-2xl text-center'}`}>
                    <h3 className="font-serif text-h1 font-normal leading-display text-brand-black">
                      {step.heading}
                    </h3>
                    <div className="mt-6 text-lg leading-body-lg text-dark-grey">
                      {renderRichText(step.body)}
                    </div>
                  </div>

                  {imageUrl && step.image && (
                    <div className="relative aspect-[4/3] w-full flex-1 overflow-hidden rounded-2xl lg:aspect-square">
                      <MediaImage
                        media={step.image}
                        mediaSize="large"
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="mt-10 flex items-center justify-between">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentStep === 0}
              className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold text-mid-grey transition-colors hover:text-brand-black disabled:invisible"
              aria-label="Previous step"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>

            {isLastStep ? null : (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-2 rounded-md bg-rich-red px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-deep-red hover:shadow-md active:scale-[0.97]"
                aria-label="Next step"
              >
                Next
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Final CTA (shown on last step) */}
        {showFinalCTA && (
          <div className="mt-16 rounded-2xl bg-warm-white p-8 text-center lg:p-12">
            <h3 className="font-serif text-h2 font-normal leading-heading text-brand-black">
              {finalCTA.heading}
            </h3>
            {finalCTA.text && (
              <p className="mx-auto mt-4 max-w-lg text-lg leading-body-lg text-dark-grey">
                {finalCTA.text}
              </p>
            )}
            {finalCTA.buttons && finalCTA.buttons.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                {finalCTA.buttons.map((btn) => (
                  <Button
                    key={btn.id ?? btn.href}
                    href={btn.href}
                    variant={btn.variant ?? 'primary'}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
