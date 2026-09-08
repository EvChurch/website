import { expect, it } from 'vitest'
import { visibleWaveform } from './waveform-detail'
it('reveals short pauses when zoomed while keeping overview paths bounded', () => {
  const peaks = Array.from({length: 630000}, () => 0)
  peaks[420010] = 1
  peaks[420030] = 0.7
  const overview = visibleWaveform(peaks, 6300, 0, 6300)
  expect(overview.length).toBeLessThanOrEqual(1000)
  expect(Math.max(...overview.map(point => point.peak))).toBe(1)
  const detail = visibleWaveform(peaks, 6300, 4200, 2)
  expect(detail).toHaveLength(200)
  expect(detail[10].peak).toBe(1)
  expect(detail[20].peak).toBe(0)
  expect(detail[30].peak).toBe(0.7)
  expect(detail[10].from).toBeCloseTo(4200.1)
})
it('handles empty data and the final partial view', () => {
  expect(visibleWaveform([], 100, 0, 2)).toEqual([])
  expect(visibleWaveform([0.1, 0.8, 0.2], 3, 2.5, 2)).toEqual([{ from: 2, to: 3, peak: 0.2 }])
})
