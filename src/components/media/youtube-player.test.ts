// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableIframePageLoading":true}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createYouTubePlayer } from './youtube-player'

describe('Video.js 10 YouTube playback', () => {
  beforeEach(() => {
    // Test the real Video.js element without loading third-party scripts.
    vi.stubGlobal('YT', { Player: class {
      addEventListener() {}
      destroy() {}
    } })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('preserves custom controls, start/resume configuration and player disposal', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const player = createYouTubePlayer(container, {
      videoId: 'aqz-KE-bpKQ', startSeconds: 30, muted: true,
    })
    const media = container.querySelector('youtube-video')!
    expect(media).not.toBeNull()
    expect(media.source?.engine?.youtube).toMatchObject({ start: 30, rel: 0, disablekb: 1 })
    expect(media.controls).toBe(false)
    expect(media.autoplay).toBe(true)
    expect(media.playsInline).toBe(true)
    expect(media.style.minWidth).toBe('0')
    await expect.poll(() => media.shadowRoot!.querySelector('iframe')!.getAttribute('src')).toContain('mute=1')
    expect(player.muted()).toBe(true)
    player.volume(0.4)
    player.muted(false)
    player.playbackRate(1.5)
    player.currentTime(45)
    expect(player.volume()).toBe(0.4)
    expect(player.muted()).toBe(false)
    expect(player.playbackRate()).toBe(1.5)
    expect(player.currentTime()).toBe(45)

    const playing = vi.fn()
    const once = vi.fn()
    const disposed = vi.fn()
    player.on('playing', playing)
    player.one('playing', once)
    player.on('dispose', disposed)
    media.dispatchEvent(new Event('playing'))
    media.dispatchEvent(new Event('playing'))
    expect(playing).toHaveBeenCalledTimes(2)
    expect(once).toHaveBeenCalledOnce()
    await new Promise<void>((resolve) => player.ready(resolve))
    player.dispose()
    player.dispose()
    expect(player.isDisposed()).toBe(true)
    expect(disposed).toHaveBeenCalledOnce()
    expect(media.isConnected).toBe(false)
    media.dispatchEvent(new Event('playing'))
    expect(playing).toHaveBeenCalledTimes(2)
    container.remove()
  })

  it('rejects non-video IDs before creating an embedded document', () => {
    const container = document.createElement('div')
    for (const videoId of ['javascript:alert(1)', '"><script>', 'https://example.com/watch']) {
      expect(() => createYouTubePlayer(container, { videoId })).toThrow('Invalid YouTube video ID')
      expect(container.childElementCount).toBe(0)
    }
  })
})
