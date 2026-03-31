'use client'

import { useState } from 'react'

interface VideoBlockProps {
  url: string
  caption?: string | null
}

type VideoEmbed =
  | { provider: 'youtube'; id: string }
  | { provider: 'vimeo'; id: string }

function parseVideoUrl(url: string): VideoEmbed | null {
  // YouTube
  const ytPatterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of ytPatterns) {
    const match = url.match(pattern)
    if (match?.[1]) return { provider: 'youtube', id: match[1] }
  }

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch?.[1]) return { provider: 'vimeo', id: vimeoMatch[1] }

  return null
}

function getThumbnailUrl(video: VideoEmbed): string {
  if (video.provider === 'youtube') {
    return `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`
  }
  // Vimeo thumbnails fetched via oEmbed at build time would be ideal,
  // but for now we use the vumbnail service
  return `https://vumbnail.com/${video.id}.jpg`
}

function getEmbedSrc(video: VideoEmbed): string {
  if (video.provider === 'youtube') {
    return `https://www.youtube-nocookie.com/embed/${video.id}?rel=0&autoplay=1`
  }
  return `https://player.vimeo.com/video/${video.id}?autoplay=1&title=0&byline=0&portrait=0&color=E22A30`
}

export function VideoBlockComponent({ url, caption }: VideoBlockProps) {
  const [playing, setPlaying] = useState(false)
  const video = parseVideoUrl(url)

  if (!video) {
    return null
  }

  const thumbnail = getThumbnailUrl(video)

  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-4xl px-6 sm:px-8 lg:px-12">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-brand-black shadow-lg">
          {playing ? (
            <iframe
              src={getEmbedSrc(video)}
              title={caption ?? 'Video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group absolute inset-0 flex cursor-pointer items-center justify-center"
              aria-label={caption ? `Play ${caption}` : 'Play video'}
            >
              {/* Thumbnail */}
              <img
                src={thumbnail}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-brand-black/30 transition-colors duration-300 group-hover:bg-brand-black/40" />

              {/* Play button */}
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-rich-red shadow-lg transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="ml-1 h-7 w-7 text-white sm:h-8 sm:w-8"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          )}
        </div>

        {caption && (
          <p className="mt-4 text-center text-sm text-mid-grey">
            {caption}
          </p>
        )}
      </div>
    </section>
  )
}
