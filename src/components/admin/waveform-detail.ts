/** Preserve peaks in the overview without sending millions of SVG commands per frame. */
export function visibleWaveform(peaks: number[], duration: number, start: number, span: number) {
  if (!peaks.length || duration <= 0 || span <= 0) return []
  const interval = duration / peaks.length
  const first = Math.max(0, Math.floor(start / interval))
  const last = Math.min(peaks.length, Math.ceil((start + span) / interval))
  const stride = Math.max(1, Math.ceil((last - first) / 1000))
  const result: { from: number; to: number; peak: number }[] = []
  for (let i = first; i < last; i += stride) {
    const end = Math.min(i + stride, last)
    let peak = 0
    for (let j = i; j < end; j++) peak = Math.max(peak, peaks[j])
    result.push({ from: i * interval, to: end * interval, peak })
  }
  return result
}
