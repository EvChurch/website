import '@videojs/html/media/youtube-video'

interface YouTubePlayerOptions {
  videoId: string
  startSeconds?: number
  muted?: boolean
}

// Keep the existing Ev controls independent of the Video.js playback engine.
export function createYouTubePlayer(container: HTMLElement, options: YouTubePlayerOptions) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(options.videoId)) {
    throw new Error('Invalid YouTube video ID')
  }

  const media = document.createElement('youtube-video')
  media.className = 'video-js'
  Object.assign(media.style, { display: 'block', width: '100%', height: '100%', minWidth: '0', minHeight: '0' })
  media.autoplay = true
  media.controls = false
  media.defaultMuted = options.muted ?? false
  media.muted = options.muted ?? false
  media.playsInline = true
  media.preload = 'auto'
  media.source = {
    src: `https://www.youtube.com/watch?v=${options.videoId}`,
    engine: { youtube: { start: options.startSeconds, mute: options.muted ? 1 : 0, rel: 0, iv_load_policy: 3, disablekb: 1 } },
  }

  let disposed = false
  const listeners = new AbortController()
  container.replaceChildren(media)
  media.shadowRoot?.querySelector('iframe')?.setAttribute('title', 'Ev Church video')

  return {
    play: () => media.play(),
    pause: () => media.pause(),
    paused: () => media.paused,
    duration: () => media.duration,
    currentTime(value?: number) {
      if (value !== undefined) media.currentTime = value
      return media.currentTime
    },
    playbackRate(value?: number) {
      if (value !== undefined) media.playbackRate = value
      return media.playbackRate
    },
    volume(value?: number) {
      if (value !== undefined) media.volume = value
      return media.volume
    },
    muted(value?: boolean) {
      if (value !== undefined) media.muted = value
      return media.muted
    },
    on(event: string, callback: () => void) {
      media.addEventListener(event, callback, { signal: listeners.signal })
    },
    one(event: string, callback: () => void) {
      media.addEventListener(event, callback, { once: true, signal: listeners.signal })
    },
    ready(callback: () => void) {
      queueMicrotask(() => { if (!disposed) callback() })
    },
    isDisposed: () => disposed,
    dispose() {
      if (disposed) return
      disposed = true
      media.dispatchEvent(new Event('dispose'))
      listeners.abort()
      // Disconnecting the custom element destroys its YouTube engine and timers.
      media.remove()
    },
  }
}

export type YouTubePlayer = ReturnType<typeof createYouTubePlayer>
