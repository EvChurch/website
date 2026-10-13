'use client'
import { useMediaPlayer, type SermonMedia } from '@/components/media/MediaPlayerProvider'
import type { TranscriptSegment } from '@/lib/sermon-articles/krisp'

export function SermonTranscript({ segments, sermon }: { segments: TranscriptSegment[]; sermon: SermonMedia }) {
  const { play } = useMediaPlayer()
  return <section className="border-t border-warm-white/10 py-8 text-warm-white">
    <div className="mx-auto max-w-5xl px-6">
      <details>
        <summary className="cursor-pointer text-xl font-bold">Transcript</summary>
        <div className="mt-6 space-y-4">
          {segments.map((segment, index) => <p key={index} className="flex gap-4 leading-relaxed">
            <button className="shrink-0 self-start rounded text-rich-red underline focus-visible:outline-2 focus-visible:outline-offset-4"
              aria-label={`Play from ${Math.floor(segment.start / 60)} minutes ${Math.floor(segment.start % 60)} seconds`}
              onClick={() => play(sermon, 'audio', undefined, segment.start)}>
              {Math.floor(segment.start / 60)}:{String(Math.floor(segment.start % 60)).padStart(2, '0')}
            </button>
            <span>{segment.text}</span>
          </p>)}
        </div>
      </details>
    </div>
  </section>
}
