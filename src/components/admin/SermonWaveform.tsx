'use client'
import { useRef } from 'react'

export function SermonWaveform({
  peaks,
  duration,
  start,
  end,
  onChange,
  onSeek,
}: {
  peaks: number[]
  duration: number
  start: number
  end: number
  onChange: (start: number, end: number) => void
  onSeek: (time: number) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const dragging = useRef<'start' | 'end' | null>(null)
  const position = (clientX: number) => {
    const rect = svg.current!.getBoundingClientRect()
    return Math.max(
      0,
      Math.min(duration, ((clientX - rect.left) / rect.width) * duration),
    )
  }
  const x = (value: number) => (value / duration) * 1000
  return (
    <div>
      <svg
        ref={svg}
        className="sermon-waveform"
        viewBox="0 0 1000 120"
        preserveAspectRatio="none"
        role="img"
        aria-label="Recording waveform. Use the start and end time controls below for keyboard editing."
        onPointerMove={(event) => {
          if (!dragging.current) return
          const time = Math.round(position(event.clientX) * 10) / 10
          if (dragging.current === 'start')
            onChange(Math.min(time, end - 0.1), end)
          else onChange(start, Math.max(time, start + 0.1))
        }}
        onPointerUp={() => {
          dragging.current = null
        }}
        onPointerCancel={() => {
          dragging.current = null
        }}
        onClick={(event) => {
          if (event.target === svg.current) onSeek(position(event.clientX))
        }}
      >
        <rect
          x={x(start)}
          y="0"
          width={x(end - start)}
          height="120"
          fill="var(--theme-success-100)"
          pointerEvents="none"
        />
        <path
          d={peaks
            .map(
              (peak, index) =>
                `M${(index / peaks.length) * 1000},${60 - peak * 52}v${peak * 104}`,
            )
            .join(' ')}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.65"
          pointerEvents="none"
        />
        {(['start', 'end'] as const).map((marker) => (
          <g
            key={marker}
            onPointerDown={(event) => {
              event.preventDefault()
              dragging.current = marker
              svg.current?.setPointerCapture(event.pointerId)
            }}
            style={{ cursor: 'ew-resize' }}
          >
            <rect
              x={x(marker === 'start' ? start : end) - 10}
              width="20"
              height="120"
              fill="transparent"
            />
            <line
              x1={x(marker === 'start' ? start : end)}
              x2={x(marker === 'start' ? start : end)}
              y1="0"
              y2="120"
              stroke="#E22A30"
              strokeWidth="3"
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
