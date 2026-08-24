// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CompletionCelebration } from './CompletionCelebration'

const { celebrate, create, reset } = vi.hoisted(() => {
  const reset = vi.fn()
  const celebrate = Object.assign(vi.fn(() => Promise.resolve()), { reset })
  return { celebrate, create: vi.fn(() => celebrate), reset }
})

vi.mock('canvas-confetti', () => ({ default: { create } }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

describe('CompletionCelebration', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('hands an untouched canvas to the confetti worker', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')

    await act(async () => root.render(<CompletionCelebration />))

    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    expect(getContext).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith(canvas, {
      resize: true,
      useWorker: true,
      disableForReducedMotion: true,
    })

    await act(async () => vi.advanceTimersByTimeAsync(180))
    expect(celebrate).toHaveBeenCalledTimes(3)

    await act(async () => root.unmount())
    root = createRoot(container)
    expect(reset).toHaveBeenCalledOnce()
  })
})
