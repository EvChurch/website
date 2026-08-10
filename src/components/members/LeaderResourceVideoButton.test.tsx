// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const controls = vi.hoisted(() => ({
  currentSlug: null as string | null,
  isPlaying: false,
  isLoading: false,
  play: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}))

vi.mock('@/components/media/MediaPlayerProvider', () => ({
  useMediaPlaybackControls: () => controls,
}))
vi.mock('@/components/audio/PlayIcon', () => ({
  PlayIcon: () => <span aria-hidden="true">icon</span>,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

import { LeaderResourceVideoButton } from './LeaderResourceVideoButton'

const media = {
  id: 245,
  slug: 'connect-group-resource-245',
  title: 'Hebrews Study 4',
  access: 'members' as const,
  audioUrl: '',
  videos: [{
    campusName: 'Video',
    campusSlug: 'resource-video',
    youtubeVideoId: 'dQw4w9WgXcQ',
  }],
}

describe('LeaderResourceVideoButton', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    controls.currentSlug = null
    controls.isPlaying = false
    controls.isLoading = false
    controls.play.mockReset()
    controls.pause.mockReset()
    controls.resume.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  async function renderButton() {
    await act(async () => root.render(
      <LeaderResourceVideoButton media={media} variant="featured" />,
    ))
    return container.querySelector('button')!
  }

  it('starts a new resource as a tracked video', async () => {
    const button = await renderButton()
    await act(async () => button.click())

    expect(controls.play).toHaveBeenCalledWith(media, 'video', 'resource-video')
  })

  it('pauses the current playing resource', async () => {
    controls.currentSlug = media.slug
    controls.isPlaying = true
    const button = await renderButton()
    await act(async () => button.click())

    expect(controls.pause).toHaveBeenCalledOnce()
    expect(button.textContent).toContain('Pause')
  })

  it('resumes the current paused resource', async () => {
    controls.currentSlug = media.slug
    const button = await renderButton()
    await act(async () => button.click())

    expect(controls.resume).toHaveBeenCalledOnce()
    expect(button.textContent).toContain('Play now')
  })

  it('disables the current resource while it is loading', async () => {
    controls.currentSlug = media.slug
    controls.isLoading = true

    expect((await renderButton()).disabled).toBe(true)
  })
})
