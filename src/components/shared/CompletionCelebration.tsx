'use client'

import confetti from 'canvas-confetti'
import { useEffect, useRef } from 'react'

function canUseConfettiWorker() {
  return typeof globalThis.Worker === 'function'
    && typeof globalThis.OffscreenCanvas === 'function'
    && typeof globalThis.OffscreenCanvasRenderingContext2D === 'function'
    && typeof globalThis.createImageBitmap === 'function'
    && typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function'
}

export function CompletionCelebration() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || (!canUseConfettiWorker() && !canvas.getContext('2d'))) return

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

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full motion-reduce:hidden" aria-hidden="true" />
}
