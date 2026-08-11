import type { DailyReadingView } from './data'

export type ReadingStage = 'read' | 'reflect' | 'pray' | 'complete'

export interface ReadingPosition {
  stage: ReadingStage
  index: number
  completed: boolean
  updatedAt: string
}

export type ReadingProgressMap = Record<string, ReadingPosition>

export interface ReadingStep {
  stage: ReadingStage
  index: number
  title: string
  eyebrow: string
  content: string
}

export const PROGRESS_STORAGE_KEY = 'ev-daily-reading-progress-v1'

const aucklandDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Pacific/Auckland',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function weekStartKey(value: string | Date): string {
  const parts = aucklandDateFormatter.formatToParts(new Date(value))
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  const date = new Date(Date.UTC(year, month - 1, day))
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - daysSinceMonday)
  return date.toISOString().slice(0, 10)
}

function previousWeek(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 7)
  return date.toISOString().slice(0, 10)
}

export function buildReadingSteps(reading: DailyReadingView): ReadingStep[] {
  const passageParts = reading.passageText.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean)
  return [
    ...passageParts.map((content, index) => ({
      stage: 'read' as const,
      index,
      eyebrow: 'Read',
      title: reading.passageReference,
      content,
    })),
    ...(reading.questions.length > 0 ? [{
      stage: 'reflect' as const,
      index: 0,
      eyebrow: 'Reflect',
      title: 'Take a moment to consider',
      content: reading.questions.join('\n\n'),
    }] : []),
    ...(reading.prayerPrompts.length > 0 ? [{
      stage: 'pray' as const,
      index: 0,
      eyebrow: 'Pray',
      title: 'Take a moment to pray',
      content: reading.prayerPrompts.join('\n\n'),
    }] : []),
    { stage: 'complete', index: 0, eyebrow: 'Complete', title: 'Thanks for reading today', content: 'May God’s word stay with you as you go.' },
  ]
}

export function stepIndexForPosition(steps: ReadingStep[], position?: ReadingPosition): number {
  if (!position) return 0
  const index = steps.findIndex((step) => step.stage === position.stage && step.index === position.index)
  if (index >= 0) return index
  const stageIndex = steps.findIndex((step) => step.stage === position.stage)
  return stageIndex >= 0 ? stageIndex : 0
}

export function readProgress(): ReadingProgressMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return {}
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' ? value as ReadingProgressMap : {}
  } catch {
    return {}
  }
}

export function writeProgress(progress: ReadingProgressMap): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress))
  window.dispatchEvent(new CustomEvent('daily-reading-progress'))
}

export function savePosition(readingId: number, step: ReadingStep): ReadingProgressMap {
  const current = readProgress()
  const next = {
    ...current,
    [String(readingId)]: {
      stage: step.stage,
      index: step.index,
      completed: step.stage === 'complete' || current[String(readingId)]?.completed === true,
      updatedAt: new Date().toISOString(),
    },
  }
  writeProgress(next)
  return next
}

export function currentStreak(readings: DailyReadingView[], progress: ReadingProgressMap): number {
  let streak = 0
  for (const reading of readings) {
    if (!progress[String(reading.rockId)]?.completed) break
    streak++
  }
  return streak
}

export interface RecentReadingWeek {
  startDate: string
  readings: DailyReadingView[]
}

export function recentReadingWeeks(
  readings: DailyReadingView[],
  weekCount = 4,
): RecentReadingWeek[] {
  const latest = readings[0]
  if (!latest || weekCount < 1) return []

  const weekStarts: string[] = []
  let week = weekStartKey(latest.sourceDate)
  for (let index = 0; index < Math.floor(weekCount); index += 1) {
    weekStarts.push(week)
    week = previousWeek(week)
  }

  const allowedWeeks = new Set(weekStarts)
  const readingsByWeek = new Map<string, DailyReadingView[]>()
  for (const reading of readings.slice(1)) {
    const startDate = weekStartKey(reading.sourceDate)
    if (!allowedWeeks.has(startDate)) continue
    readingsByWeek.set(startDate, [
      ...(readingsByWeek.get(startDate) ?? []),
      reading,
    ])
  }

  return weekStarts.flatMap((startDate) => {
    const weekReadings = readingsByWeek.get(startDate)
    return weekReadings ? [{ startDate, readings: weekReadings }] : []
  })
}

export function weeklyStreak(
  readings: DailyReadingView[],
  progress: ReadingProgressMap,
  now: Date = new Date(),
): number {
  const completedWeeks = new Set(
    readings
      .filter((reading) => progress[String(reading.rockId)]?.completed)
      .map((reading) => weekStartKey(reading.sourceDate)),
  )
  const currentWeek = weekStartKey(now)
  let week = completedWeeks.has(currentWeek)
    ? currentWeek
    : previousWeek(currentWeek)
  let streak = 0

  while (completedWeeks.has(week)) {
    streak += 1
    week = previousWeek(week)
  }

  return streak
}
