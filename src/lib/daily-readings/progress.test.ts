import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DailyReadingView } from './data'
import {
  buildReadingSteps,
  currentStreak,
  PROGRESS_STORAGE_KEY,
  recentReadingWeeks,
  savePosition,
  stepIndexForPosition,
  weeklyStreak,
} from './progress'

const reading: DailyReadingView = {
  id: 1,
  rockId: 16160,
  sourceName: 'DBR 2026/08/11',
  sourceDate: '2026-08-10T12:00:00.000Z',
  rockSentAt: '2026-08-10T17:00:53.340Z',
  openingScripture: 'Your word is a lamp.',
  passageReference: 'Hebrews 5:11-14',
  passageText: 'First paragraph.\n\nSecond paragraph.',
  bibleVersionAbbreviation: 'CSB',
  bibleVersionTitle: 'Christian Standard Bible',
  apiBibleFumsToken: null,
  bibleCopyright: null,
  questions: ['Question one?', 'Question two?'],
  prayerPrompts: ['Pray one.', 'Pray two.'],
}

describe('daily reading progress', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('builds the complete guided sequence and resumes an exact source item', () => {
    const steps = buildReadingSteps(reading)
    expect(steps.map(({ stage }) => stage)).toEqual([
      'read', 'read', 'reflect', 'pray', 'complete',
    ])
    expect(steps[2]).toMatchObject({
      stage: 'reflect', index: 0, eyebrow: 'Reflect', content: 'Question one?\n\nQuestion two?',
    })
    expect(steps[3]).toMatchObject({
      stage: 'pray', index: 0, eyebrow: 'Pray', title: 'Take a moment to pray', content: 'Pray one.\n\nPray two.',
    })
    expect(stepIndexForPosition(steps, {
      stage: 'reflect', index: 1, completed: false, updatedAt: '',
    })).toBe(2)
  })

  it('counts only the completed suffix ending at the newest published reading', () => {
    const readings = [reading, { ...reading, rockId: 2 }, { ...reading, rockId: 3 }]
    expect(currentStreak(readings, {
      '16160': { stage: 'complete', index: 0, completed: true, updatedAt: '' },
      '2': { stage: 'complete', index: 0, completed: true, updatedAt: '' },
    })).toBe(2)
    expect(currentStreak(readings, {
      '2': { stage: 'complete', index: 0, completed: true, updatedAt: '' },
    })).toBe(0)
  })

  it('counts consecutive Monday-to-Sunday weeks with at least one completed reading', () => {
    const readings = [
      { ...reading, rockId: 1, sourceDate: '2026-08-10T12:00:00.000Z' },
      { ...reading, rockId: 2, sourceDate: '2026-08-04T12:00:00.000Z' },
      { ...reading, rockId: 3, sourceDate: '2026-07-28T12:00:00.000Z' },
    ]
    const progress = {
      '1': { stage: 'complete' as const, index: 0, completed: true, updatedAt: '' },
      '2': { stage: 'complete' as const, index: 0, completed: true, updatedAt: '' },
      '3': { stage: 'complete' as const, index: 0, completed: true, updatedAt: '' },
    }

    expect(weeklyStreak(readings, progress, new Date('2026-08-12T00:00:00.000Z'))).toBe(3)
  })

  it('keeps the weekly streak alive while the current week is still in progress', () => {
    const readings = [
      { ...reading, rockId: 2, sourceDate: '2026-08-04T12:00:00.000Z' },
      { ...reading, rockId: 3, sourceDate: '2026-07-28T12:00:00.000Z' },
    ]
    const progress = {
      '2': { stage: 'complete' as const, index: 0, completed: true, updatedAt: '' },
      '3': { stage: 'complete' as const, index: 0, completed: true, updatedAt: '' },
    }

    expect(weeklyStreak(readings, progress, new Date('2026-08-12T00:00:00.000Z'))).toBe(2)
  })

  it('counts multiple completed readings in one week only once', () => {
    const readings = [
      { ...reading, rockId: 1, sourceDate: '2026-08-10T12:00:00.000Z' },
      { ...reading, rockId: 4, sourceDate: '2026-08-11T12:00:00.000Z' },
      { ...reading, rockId: 3, sourceDate: '2026-07-28T12:00:00.000Z' },
    ]
    const progress = {
      '1': { stage: 'complete' as const, index: 0, completed: true, updatedAt: '' },
      '4': { stage: 'complete' as const, index: 0, completed: true, updatedAt: '' },
      '3': { stage: 'complete' as const, index: 0, completed: true, updatedAt: '' },
    }

    expect(weeklyStreak(readings, progress, new Date('2026-08-12T00:00:00.000Z'))).toBe(1)
  })

  it('groups previous readings from the latest four calendar weeks without repeating today', () => {
    const readings = [
      { ...reading, rockId: 1, sourceDate: '2026-08-11T12:00:00.000Z' },
      { ...reading, rockId: 2, sourceDate: '2026-08-10T12:00:00.000Z' },
      { ...reading, rockId: 3, sourceDate: '2026-08-04T12:00:00.000Z' },
      { ...reading, rockId: 4, sourceDate: '2026-07-28T12:00:00.000Z' },
      { ...reading, rockId: 5, sourceDate: '2026-07-21T12:00:00.000Z' },
      { ...reading, rockId: 6, sourceDate: '2026-07-14T12:00:00.000Z' },
      { ...reading, rockId: 7, sourceDate: '2026-07-07T12:00:00.000Z' },
    ]

    expect(recentReadingWeeks(readings)).toEqual([
      { startDate: '2026-08-10', readings: [readings[1]] },
      { startDate: '2026-08-03', readings: [readings[2]] },
      { startDate: '2026-07-27', readings: [readings[3]] },
      { startDate: '2026-07-20', readings: [readings[4]] },
    ])
  })

  it('keeps a day completed when the reader starts it again', () => {
    const storage = new Map<string, string>()
    storage.set(PROGRESS_STORAGE_KEY, JSON.stringify({
      '16160': { stage: 'complete', index: 0, completed: true, updatedAt: '' },
    }))
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      dispatchEvent: vi.fn(),
    })
    vi.stubGlobal('CustomEvent', class {
      constructor(public type: string) {}
    })

    const progress = savePosition(16160, {
      stage: 'read', index: 0, title: '', eyebrow: '', content: '',
    })

    expect(progress['16160']).toMatchObject({ stage: 'read', completed: true })
  })
})
