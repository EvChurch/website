'use client'

import confetti from 'canvas-confetti'
import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { DailyReadingView } from '@/lib/daily-readings/data'
import { apiBibleFumsTokens, reportApiBibleView } from '@/lib/api-bible-fums'
import {
  buildReadingSteps,
  readProgress,
  savePosition,
  stepIndexForPosition,
} from '@/lib/daily-readings/progress'
import { parsePassageText } from '@/lib/daily-readings/passage'

const STAGES = ['read', 'reflect', 'pray'] as const

function CompletionCelebration() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const celebrate = confetti.create(canvas, {
      resize: true,
      useWorker: true,
      disableForReducedMotion: true,
    })
    const timers: number[] = []

    void celebrate({
      particleCount: 60,
      angle: 58,
      spread: 58,
      startVelocity: 52,
      decay: 0.91,
      gravity: 0.9,
      origin: { x: 0.03, y: 0.92 },
    })

    timers.push(window.setTimeout(() => {
      void celebrate({
        particleCount: 60,
        angle: 122,
        spread: 58,
        startVelocity: 52,
        decay: 0.91,
        gravity: 0.9,
        origin: { x: 0.97, y: 0.92 },
      })
    }, 90))

    timers.push(window.setTimeout(() => {
      void celebrate({
        particleCount: 45,
        angle: 90,
        spread: 110,
        startVelocity: 36,
        decay: 0.92,
        gravity: 0.82,
        scalar: 0.9,
        origin: { x: 0.5, y: 0.84 },
      })
    }, 180))

    return () => {
      timers.forEach(window.clearTimeout)
      celebrate.reset()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-20 h-full w-full motion-reduce:hidden"
      aria-hidden="true"
    />
  )
}

export function DailyReadingFlow({ reading }: { reading: DailyReadingView }) {
  const steps = useMemo(() => buildReadingSteps(reading), [reading])
  const [current, setCurrent] = useState(0)
  const [ready, setReady] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const reportedFumsToken = useRef<string | null>(null)
  const step = steps[current]

  useEffect(() => {
    setCurrent(stepIndexForPosition(steps, readProgress()[String(reading.rockId)]))
    setReady(true)
  }, [reading.rockId, steps])

  useEffect(() => {
    const token = reading.apiBibleFumsToken
    if (!ready || step.stage !== 'read' || !token || reportedFumsToken.current === token) return
    apiBibleFumsTokens(token).forEach((value) => reportApiBibleView(window, value))
    reportedFumsToken.current = token
  }, [reading.apiBibleFumsToken, ready, step.stage])

  function move(nextIndex: number) {
    const bounded = Math.max(0, Math.min(steps.length - 1, nextIndex))
    setCurrent(bounded)
    savePosition(reading.rockId, steps[bounded])
    window.setTimeout(() => headingRef.current?.focus(), 0)
  }

  if (!ready) {
    return <div className="min-h-[28rem] rounded-2xl border border-warm-grey bg-white/60" aria-label="Loading saved progress" />
  }

  return (
    <div className="mx-auto max-w-4xl">
      {reading.apiBibleFumsToken && (
        <Script src="https://pkg.api.bible/fumsV3.min.js" strategy="afterInteractive" />
      )}
      {step.stage !== 'complete' && (
        <ol className="mb-5 flex items-center" aria-label="Reading steps">
          {STAGES.map((stage, index) => (
            <li
              key={stage}
              className={index < STAGES.length - 1 ? 'flex flex-1 items-center' : 'flex items-center'}
              aria-current={step.stage === stage ? 'step' : undefined}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${step.stage === stage ? 'bg-rich-red' : 'bg-warm-grey'}`} />
              <span className={`ml-2 text-[0.65rem] font-bold uppercase tracking-[0.08em] sm:text-xs ${step.stage === stage ? 'text-rich-red' : 'text-mid-grey/60'}`}>
                {stage}
              </span>
              {index < STAGES.length - 1 && <span className="mx-3 h-px flex-1 bg-warm-grey" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      )}

      {step.stage === 'complete' ? (
        <article className="relative overflow-hidden rounded-2xl border border-warm-grey/80 bg-white shadow-[0_20px_60px_rgba(15,0,4,0.08)]">
          <CompletionCelebration />
          <div className="grid md:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
            <div className="px-6 py-8 sm:px-12 sm:py-10 lg:px-16">
              <h1 ref={headingRef} tabIndex={-1} className="text-[clamp(1.8rem,3vw,2.5rem)] leading-tight text-brand-black outline-none">
                {step.title}
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-dark-grey">{step.content}</p>
              <blockquote className="mt-7 max-w-2xl">
                <p className="font-serif text-xl leading-[1.85] text-dark-grey sm:text-[1.35rem]">
                  Because of the Lord’s faithful love we do not perish, for his mercies never end. They are new every morning; great is your faithfulness!
                </p>
                <cite className="mt-3 block text-xs font-bold not-italic uppercase tracking-[0.14em] text-mid-grey">
                  Lamentations 3:22–23
                </cite>
              </blockquote>
            </div>
            <div className="relative order-first min-h-56 md:order-last md:min-h-full">
              <Image
                src="/images/daily-readings/completion-dawn.webp"
                alt="Morning light over a winding path through rolling hills"
                fill
                sizes="(min-width: 768px) 22rem, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </article>
      ) : (
        <article className="overflow-hidden rounded-2xl border border-warm-grey/80 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,0,4,0.08)] sm:px-12 sm:py-10 lg:px-16">
          <h1 ref={headingRef} tabIndex={-1} className="text-[clamp(1.8rem,3vw,2.5rem)] leading-tight text-brand-black outline-none">
            {step.title}
          </h1>
          {step.stage === 'read' ? (
            <div className="mt-4">
              <p className="whitespace-pre-line font-serif text-xl leading-[1.85] text-dark-grey sm:text-[1.35rem]">
                {parsePassageText(step.content).map((segment, index) => (
                  segment.type === 'verse' ? (
                    <sup
                      key={`${segment.number}-${index}`}
                      aria-label={`Verse ${segment.number}`}
                      className="font-sans text-[0.58em] font-bold leading-none text-dark-grey"
                    >
                      {segment.number}
                    </sup>
                  ) : (
                    <span key={index}>{segment.value}</span>
                  )
                ))}
              </p>
              {(reading.bibleVersionAbbreviation || reading.bibleCopyright) && (
                <p className="mt-7 text-xs leading-relaxed text-mid-grey">
                  {reading.bibleVersionAbbreviation && (
                    <span className="font-bold uppercase tracking-[0.12em]">
                      {reading.bibleVersionAbbreviation}
                    </span>
                  )}
                  {reading.bibleVersionAbbreviation && reading.bibleCopyright && ' · '}
                  {reading.bibleCopyright}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {step.content.split(/\n\s*\n/u).map((content, index) => (
                <p key={index} className="font-serif text-xl leading-[1.85] text-dark-grey sm:text-[1.35rem]">
                  {content}
                </p>
              ))}
            </div>
          )}
        </article>
      )}
      {step.stage === 'complete' ? (
        <nav className="mt-4 flex items-center justify-between px-1" aria-label="Completed reading actions">
          <button
            type="button"
            onClick={() => move(0)}
            className="group inline-flex min-h-11 items-center gap-2 text-sm font-bold text-dark-grey transition-colors hover:text-rich-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rich-red"
          >
            <span className="text-lg font-normal transition-transform group-hover:-rotate-45" aria-hidden="true">↻</span>
            Read again
          </button>
          <Link
            href="/members/daily-readings"
            rel="nofollow"
            className="group inline-flex min-h-11 items-center gap-2 text-sm font-bold text-rich-red transition-colors hover:text-deep-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rich-red"
          >
            View your progress
            <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
          </Link>
        </nav>
      ) : (
        <nav className="mt-5 flex items-center justify-end gap-3" aria-label="Reading step navigation">
          <button
            type="button"
            onClick={() => move(current - 1)}
            disabled={current === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-warm-grey bg-white px-4 text-sm font-bold text-dark-grey transition-colors hover:border-brand-black hover:text-brand-black disabled:invisible"
          >
            <span aria-hidden="true">←</span>
            Previous
          </button>
          <button
            type="button"
            onClick={() => move(current + 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-rich-red px-5 text-sm font-bold text-white transition-colors hover:bg-deep-red"
          >
            Next
            <span aria-hidden="true">→</span>
          </button>
        </nav>
      )}
    </div>
  )
}
