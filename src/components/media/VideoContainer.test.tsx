// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VideoOption } from './MediaPlayerProvider'

const player = vi.hoisted(() => ({
  currentSermon: null,
  activeVideo: null as VideoOption | null,
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
vi.mock('video.js', () => ({
  default: () => ({
    on: vi.fn(),
    one: vi.fn(),
    ready: vi.fn(),
    isDisposed: () => false,
    dispose: vi.fn(),
  }),
}))
vi.mock('videojs-youtube', () => ({}))
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
    player.activeVideo = null
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

  it('links to the active YouTube video in a new tab and updates when the video changes', async () => {
    player.activeVideo = { campusName: 'Video', campusSlug: 'resource-video', youtubeVideoId: 'dQw4w9WgXcQ' }
    await act(async () => root.render(<VideoContainer />))

    const link = container.querySelector<HTMLAnchorElement>('a')
    expect(link?.href).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(link?.target).toBe('_blank')
    expect(link?.rel).toBe('noopener noreferrer')
    expect(link?.textContent).toBe('Open in YouTube (opens in a new tab)')
    expect(link?.tabIndex).toBe(0)
    link?.focus()
    expect(document.activeElement).toBe(link)

    player.activeVideo = { ...player.activeVideo, youtubeVideoId: 'abcdefgh_-1' }
    await act(async () => root.render(<VideoContainer />))
    expect(container.querySelector('a')?.href).toBe('https://www.youtube.com/watch?v=abcdefgh_-1')

    player.isVideoExpanded = false
    await act(async () => root.render(<VideoContainer />))
    expect(container.querySelector('a')).toBeNull()
  })

  it.each([null, '', '123456789', 'abcdefghijkx', 'bad id here', 'https://vimeo.com/123456789', 'abc&list=12'])('omits the YouTube action for missing or invalid video data: %s', async (youtubeVideoId) => {
    player.activeVideo = youtubeVideoId === null ? null : {
      campusName: 'Video', campusSlug: 'resource-video', youtubeVideoId,
    }
    await act(async () => root.render(<VideoContainer />))
    expect(container.querySelector('a')).toBeNull()
  })
})
