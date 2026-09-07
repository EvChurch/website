'use client'
import { useEffect, useRef, useState } from 'react'

export function SermonWaveform({
  peaks,
  duration,
  start,
  end,
  currentTime,
  disabled,
  onChange,
  onSeek,
  onAudition,
}: {
  peaks: number[]
  duration: number
  start: number
  end: number
  currentTime: number
  disabled: boolean
  onChange: (start: number, end: number) => void
  onSeek: (time: number) => void
  onAudition: (time: number, end: number) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const dragging = useRef<'start' | 'end' | null>(null)
  const changed = useRef(false)
  const selection = useRef({ start, end })
  selection.current = { start, end }
  const [view, setView] = useState({ start: 0, span: duration })
  const viewport = useRef(view)
  viewport.current = view
  const zoom = (factor: number, anchor: number) => {
    setView((old) => {
      const span = Math.max(
        Math.min(2, duration),
        Math.min(duration, old.span * factor),
      )
      return {
        span,
        start: Math.max(
          0,
          Math.min(duration - span, old.start + anchor * (old.span - span)),
        ),
      }
    })
  }
  useEffect(() => {
    const element = svg.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        const delta =
          Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY
        setView((old) => ({
          ...old,
          start: Math.max(
            0,
            Math.min(
              duration - old.span,
              old.start + (delta / rect.width) * old.span,
            ),
          ),
        }))
      } else {
        const anchor = Math.max(
          0,
          Math.min(1, (event.clientX - rect.left) / rect.width),
        )
        const factor = Math.exp(
          Math.max(
            -1,
            Math.min(
              1,
              event.deltaY * (event.deltaMode === 1 ? 16 : 1) * 0.002,
            ),
          ),
        )
        setView((old) => {
          const span = Math.max(
            Math.min(2, duration),
            Math.min(duration, old.span * factor),
          )
          return {
            span,
            start: Math.max(
              0,
              Math.min(duration - span, old.start + anchor * (old.span - span)),
            ),
          }
        })
      }
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [duration])
  const position = (clientX: number) => {
    const rect = svg.current!.getBoundingClientRect()
    return Math.max(
      0,
      Math.min(
        duration,
        viewport.current.start +
          ((clientX - rect.left) / rect.width) * viewport.current.span,
      ),
    )
  }
  const x = (value: number) => ((value - view.start) / view.span) * 1000
  const move = (marker: 'start' | 'end', time: number) => {
    const old = selection.current
    const next =
      marker === 'start'
        ? { start: Math.max(0, Math.min(old.end - 0.1, time)), end: old.end }
        : {
            start: old.start,
            end: Math.min(duration, Math.max(old.start + 0.1, time)),
          }
    selection.current = next
    changed.current = true
    onChange(next.start, next.end)
    return next
  }
  const audition = (marker: 'start' | 'end') => {
    const cut = selection.current
    onAudition(
      marker === 'start' ? cut.start : Math.max(cut.start, cut.end - 5),
      cut.end,
    )
  }
  const format = (time: number) =>
    new Date(Math.max(0, time) * 1000).toISOString().slice(11, 22)
  return (
    <div>
      <div className="sermon-manager__row">
        <button type="button" onClick={() => zoom(0.5, 0.5)}>
          Zoom in
        </button>
        <button type="button" onClick={() => zoom(2, 0.5)}>
          Zoom out
        </button>
        <button
          type="button"
          onClick={() => setView({ start: 0, span: duration })}
        >
          Fit recording
        </button>
        <button
          type="button"
          onClick={() => setView({ start, span: end - start })}
        >
          Fit selection
        </button>
        <button
          type="button"
          aria-label="Pan earlier"
          onClick={() =>
            setView((old) => ({
              ...old,
              start: Math.max(0, old.start - old.span / 2),
            }))
          }
        >
          ←
        </button>
        <button
          type="button"
          aria-label="Pan later"
          onClick={() =>
            setView((old) => ({
              ...old,
              start: Math.min(duration - old.span, old.start + old.span / 2),
            }))
          }
        >
          →
        </button>
      </div>
      <p>
        Click to move the playhead. Scroll to zoom; Shift-scroll or Left/Right
        on the timeline to pan. Drag either cut edge, or focus it and use arrow
        keys (Shift for finer adjustments).
      </p>
      <svg
        ref={svg}
        className="sermon-waveform"
        viewBox="0 0 1000 150"
        preserveAspectRatio="none"
        role="group"
        tabIndex={0}
        aria-label="Recording timeline"
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            !['ArrowLeft', 'ArrowRight'].includes(event.key)
          )
            return
          event.preventDefault()
          const direction = event.key === 'ArrowLeft' ? -1 : 1
          setView((old) => ({
            ...old,
            start: Math.max(
              0,
              Math.min(
                duration - old.span,
                old.start +
                  direction * old.span * (event.shiftKey ? 0.02 : 0.1),
              ),
            ),
          }))
        }}
        onPointerDown={(event) => {
          if (dragging.current) return
          event.currentTarget.focus()
          onSeek(position(event.clientX))
        }}
        onPointerMove={(event) => {
          if (!dragging.current || disabled) return
          move(
            dragging.current,
            Math.round(position(event.clientX) * 100) / 100,
          )
        }}
        onPointerUp={(event) => {
          const marker = dragging.current
          dragging.current = null
          if (svg.current?.hasPointerCapture(event.pointerId))
            svg.current.releasePointerCapture(event.pointerId)
          if (marker && changed.current) audition(marker)
        }}
        onPointerCancel={() => {
          dragging.current = null
        }}
      >
        <rect
          x={x(start)}
          y="25"
          width={((end - start) / view.span) * 1000}
          height="125"
          fill="var(--theme-success-100)"
          pointerEvents="none"
        />
        <path
          d={peaks
            .map((peak, i) => ({ peak, time: (i / peaks.length) * duration }))
            .filter(
              (p) =>
                p.time + duration / peaks.length >= view.start &&
                p.time <= view.start + view.span,
            )
            .map(
              (p) =>
                `M${x(p.time)},${87 - p.peak * 55}h${(duration / peaks.length / view.span) * 1000}v${p.peak * 110}h${(-duration / peaks.length / view.span) * 1000}z`,
            )
            .join(' ')}
          fill="currentColor"
          opacity="0.65"
          pointerEvents="none"
        />
        {Array.from({ length: 6 }, (_, i) => (
          <text
            key={i}
            x={i * 200}
            y="17"
            textAnchor={i === 0 ? 'start' : i === 5 ? 'end' : 'middle'}
            fill="currentColor"
            fontSize="12"
            pointerEvents="none"
          >
            {format(view.start + (view.span * i) / 5)}
          </text>
        ))}
        {(['start', 'end'] as const).map((marker) => {
          const time = marker === 'start' ? start : end
          return (
            <g
              key={marker}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled}
              aria-label={`${marker} cut boundary`}
              aria-valuemin={marker === 'start' ? 0 : start + 0.1}
              aria-valuemax={marker === 'start' ? end - 0.1 : duration}
              aria-valuenow={time}
              aria-valuetext={format(time)}
              onFocus={() => {
                if (time < view.start || time > view.start + view.span)
                  setView((old) => ({
                    ...old,
                    start: Math.max(
                      0,
                      Math.min(duration - old.span, time - old.span / 2),
                    ),
                  }))
              }}
              onKeyDown={(event) => {
                if (
                  disabled ||
                  !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                    event.key,
                  )
                )
                  return
                event.preventDefault()
                move(
                  marker,
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? duration
                      : time +
                        (event.key === 'ArrowLeft' ? -1 : 1) *
                          (event.shiftKey ? 0.1 : 1),
                )
                audition(marker)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                if (disabled) return
                event.preventDefault()
                dragging.current = marker
                changed.current = false
                svg.current?.setPointerCapture(event.pointerId)
              }}
              style={{ cursor: disabled ? 'default' : 'ew-resize' }}
            >
              <rect
                x={Math.max(0, Math.min(980, x(time) - 10))}
                y="25"
                width={
                  time < view.start || time > view.start + view.span ? 0 : 20
                }
                height="125"
                fill="transparent"
              />
              <line
                x1={x(time)}
                x2={x(time)}
                y1="25"
                y2="150"
                stroke="#E22A30"
                strokeWidth="3"
              />
              <path
                d={
                  marker === 'start'
                    ? `M${x(time)},25h12v16h-12z`
                    : `M${x(time)},25h-12v16h12z`
                }
                fill="#E22A30"
              />
            </g>
          )
        })}
        <g pointerEvents="none" aria-label="Playhead">
          <line
            x1={x(currentTime)}
            x2={x(currentTime)}
            y1="25"
            y2="150"
            stroke="var(--theme-text)"
            strokeWidth="1"
          />
          <path
            d={`M${x(currentTime) - 6},23h12l-6,9z`}
            fill="var(--theme-text)"
          />
        </g>
      </svg>
      <p>
        Start {format(start)} · End {format(end)} · Selected{' '}
        {format(end - start)}
      </p>
    </div>
  )
}
