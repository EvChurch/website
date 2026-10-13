// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SermonWaveform } from './SermonWaveform'
;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement
let root: Root
const change = vi.fn()
const seek = vi.fn()
const audition = vi.fn()
beforeEach(async () => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <SermonWaveform
        peaks={[0.5, 1, 0.2]}
        duration={100}
        start={10}
        end={90}
        currentTime={30}
        disabled={false}
        onChange={change}
        onSeek={seek}
        onAudition={audition}
      />,
    ),
  )
  vi.spyOn(
    container.querySelector('svg')!,
    'getBoundingClientRect',
  ).mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 150,
    width: 1000,
    height: 150,
    toJSON() {},
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
it('anchors wheel zoom to the pointer and seeks within the zoomed viewport', async () => {
  const svg = container.querySelector('svg')!
  await act(async () => {
    const wheel = new WheelEvent('wheel', {
      deltaY: -300,
      deltaX: 0,
      deltaMode: 0,
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(wheel, 'clientX', { value: 750 })
    svg.dispatchEvent(wheel)
  })
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 750, bubbles: true }),
    )
  })
  expect(seek).toHaveBeenLastCalledWith(75)
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 0, bubbles: true }),
    )
  })
  expect(seek.mock.lastCall![0]).toBeGreaterThan(0)
})
it('auditions a keyboard-adjusted end five seconds before the new boundary', async () => {
  await act(async () => {
    container
      .querySelector('[aria-label="end cut boundary"]')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      )
  })
  expect(change).toHaveBeenCalledWith(10, 89)
  expect(audition).toHaveBeenCalledWith(84, 89)
})
it('supports precise start adjustment and auditions from the new start', async () => {
  await act(async () => {
    container.querySelector('[aria-label="start cut boundary"]')!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        shiftKey: true,
        bubbles: true,
      }),
    )
  })
  expect(change).toHaveBeenCalledWith(10.1, 90)
  expect(audition).toHaveBeenCalledWith(10.1, 90)
})
it('auditions a dragged boundary on release without moving the playhead on press', async () => {
  const svg = container.querySelector('svg')!
  svg.setPointerCapture = vi.fn()
  svg.hasPointerCapture = vi.fn(() => true)
  svg.releasePointerCapture = vi.fn()
  await act(async () => {
    container.querySelector('[aria-label="start cut boundary"]')!.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: 100,
        bubbles: true,
      }),
    )
  })
  expect(seek).not.toHaveBeenCalled()
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 200,
        bubbles: true,
      }),
    )
  })
  expect(change).toHaveBeenCalledWith(20, 90)
  expect(audition).not.toHaveBeenCalled()
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, bubbles: true }),
    )
  })
  expect(audition).toHaveBeenCalledWith(20, 90)
})
it.each([
  { deltaX: 100, deltaY: 0, shiftKey: true },
  { deltaX: 0, deltaY: 100, shiftKey: true },
  { deltaX: 100, deltaY: 0, shiftKey: false },
])('pans a zoomed timeline with wheel input %j', async (input) => {
  const svg = container.querySelector('svg')!
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Zoom in')!
      .click()
  })
  await act(async () => {
    const wheel = new WheelEvent('wheel', {
      deltaMode: 0,
      ...input,
      bubbles: true,
      cancelable: true,
    })
    // happy-dom does not preserve MouseEvent modifiers on WheelEvent.
    Object.defineProperty(wheel, 'shiftKey', { value: input.shiftKey })
    svg.dispatchEvent(wheel)
  })
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 0, bubbles: true }),
    )
  })
  expect(seek).toHaveBeenLastCalledWith(30)
})
it('pans with arrow keys on the timeline without changing cut boundaries', async () => {
  const svg = container.querySelector('svg')!
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Zoom in')!
      .click()
  })
  expect(svg.getAttribute('tabindex')).toBe('0')
  await act(async () => {
    svg.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
  })
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 0, bubbles: true }),
    )
  })
  expect(seek).toHaveBeenLastCalledWith(30)
  expect(change).not.toHaveBeenCalled()
  await act(async () => {
    svg.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    )
  })
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 0, bubbles: true }),
    )
  })
  expect(seek).toHaveBeenLastCalledWith(25)
})
it('drags the playhead within a zoomed view without editing or auditioning the cut', async () => {
  const svg = container.querySelector('svg')!
  svg.setPointerCapture = vi.fn()
  svg.hasPointerCapture = vi.fn(() => true)
  svg.releasePointerCapture = vi.fn()
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Zoom in')!
      .click()
  })
  await act(async () => {
    container.querySelector('[aria-label="Playhead"]')!.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: 100,
        bubbles: true,
      }),
    )
  })
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 600,
        bubbles: true,
      }),
    )
  })
  expect(seek).toHaveBeenLastCalledWith(55)
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, bubbles: true }),
    )
  })
  expect(change).not.toHaveBeenCalled()
  expect(audition).not.toHaveBeenCalled()
})
it.each(
  ['start cut boundary', 'end cut boundary', 'Playhead'].flatMap((label) =>
    [10, -50, 990, 1050].map((clientX) => ({ label, clientX })),
  ),
)(
  'auto-pans $label at $clientX and stops on release',
  async ({ label, clientX }) => {
    let frame: FrameRequestCallback | undefined
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frame = callback
        return 1
      })
    const cancel = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {})
    const svg = container.querySelector('svg')!
    svg.setPointerCapture = vi.fn()
    svg.hasPointerCapture = vi.fn(() => true)
    svg.releasePointerCapture = vi.fn()
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Zoom in')!
        .click()
    })
    await act(async () => {
      container.querySelector(`[aria-label="${label}"]`)!.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          clientX,
          bubbles: true,
        }),
      )
    })
    await act(async () => {
      frame!(16)
    })
    const first =
      label === 'Playhead'
        ? seek.mock.lastCall![0]
        : change.mock.lastCall![label.startsWith('start') ? 0 : 1]
    await act(async () => {
      frame!(32)
    })
    const second =
      label === 'Playhead'
        ? seek.mock.lastCall![0]
        : change.mock.lastCall![label.startsWith('start') ? 0 : 1]
    if (clientX < 500) expect(second).toBeLessThan(first)
    else expect(second).toBeGreaterThan(first)
    await act(async () => {
      svg.dispatchEvent(
        new PointerEvent('pointerup', { pointerId: 1, bubbles: true }),
      )
    })
    const calls = seek.mock.calls.length + change.mock.calls.length
    await act(async () => {
      frame!(48)
    })
    expect(seek.mock.calls.length + change.mock.calls.length).toBe(calls)
    raf.mockRestore()
    cancel.mockRestore()
  },
)
