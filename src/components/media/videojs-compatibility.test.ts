// @vitest-environment happy-dom

import videojs from 'video.js'
import 'videojs-youtube'
import { describe, expect, it, vi } from 'vitest'

describe('native Video.js playback API compatibility', () => {
  it('registers the existing YouTube tech and preserves player controls and lifecycle', async () => {
    expect(videojs.getTech('Youtube')).toBeDefined()
    const element = document.createElement('video')
    document.body.appendChild(element)
    const player = videojs(element, { controls: false, autoplay: false, preload: 'none' })
    try {
      await new Promise<void>((resolve) => player.ready(resolve))
      const playing = vi.fn()
      player.on('playing', playing)
      player.trigger('playing')
      expect(playing).toHaveBeenCalledOnce()
      player.volume(0.4)
      expect(player.volume()).toBe(0.4)
      player.muted(true)
      expect(player.muted()).toBe(true)
      // happy-dom cannot probe a browser's media playback-rate capability.
      player.tech().featuresPlaybackRate = true
      player.playbackRate(1.5)
      player.tech().trigger('ratechange')
      expect(player.playbackRate()).toBe(1.5)
      player.currentTime(30)
      expect(player.currentTime()).toBe(30)
      player.pause()
      expect(player.paused()).toBe(true)
    } finally {
      player.dispose()
    }
    expect(player.isDisposed()).toBe(true)
    expect(element.isConnected).toBe(false)
  })
})
