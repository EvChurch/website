// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const player = vi.hoisted(() => ({
  currentSermon: null,
  activeVideo: null,
  isVideoVisible: true,
  isVideoExpanded: true,
  isPlaying: false,
  isClosing: false,
  playbackSpeed: 1,
  pause: vi.fn(),
  resume: vi.fn(),
  close: vi.fn(),
  expandVideo: vi.fn(),
  minimizeVideo: vi.fn(),
  registerVideoPlayer: vi.fn(),
  videoContainerRef: { current: null },
  videoResumeTimeRef: { current: 0 },
  videoThumbnailRef: { current: null as HTMLDivElement | null },
  onEndedRef: { current: null },
}))

vi.mock('next/navigation', () => ({ usePathname: () => '/members' }))
vi.mock('./MediaPlayerProvider', () => ({ useMediaPlayer: () => player }))
vi.mock('@/lib/listening-store', () => ({
  useListeningStore: (selector: (state: { markCompleted: () => void }) => unknown) => (
    selector({ markCompleted: vi.fn() })
  ),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

import { VideoContainer } from './VideoContainer'

describe('VideoContainer expanded controls', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    player.isVideoVisible = true
    player.isVideoExpanded = true
    player.isClosing = false
    player.videoThumbnailRef.current = document.createElement('div')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('shows a labelled minimise control above an expanded video', async () => {
    await act(async () => root.render(<VideoContainer />))

    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Minimise video"]',
    )
    expect(button?.textContent).toContain('Minimise')
    expect(button?.parentElement?.className).toContain('minimise-control-in')
    vi.clearAllMocks()

    const playerBarControl = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Minimise video from player bar"]',
    )
    expect(playerBarControl).not.toBeNull()
    await act(async () => playerBarControl?.click())
    expect(player.minimizeVideo).toHaveBeenCalledTimes(1)

    await act(async () => button?.click())
    expect(player.minimizeVideo).toHaveBeenCalledTimes(2)
  })

  it('does not show the minimise control when the video is minimised', async () => {
    player.isVideoExpanded = false
    await act(async () => root.render(<VideoContainer />))

    expect(container.querySelector('button[aria-label="Minimise video"]')).toBeNull()
  })
})
