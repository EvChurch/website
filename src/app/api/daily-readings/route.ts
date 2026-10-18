import { getPublishedDailyReadings } from '@/lib/daily-readings/data'
import { readingOptions, readingResponse, readingSummary } from '@/lib/daily-readings/public-api'

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get('limit') ?? '20'
  const limit = Number(value)
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return readingResponse({ error: 'limit must be an integer between 1 and 100.' }, 400)
  }

  try {
    const readings = await getPublishedDailyReadings(limit)
    return readingResponse({ readings: readings.map(readingSummary) })
  } catch {
    console.error({ category: 'public-daily-readings-failed' })
    return readingResponse({ error: 'Daily readings are temporarily unavailable.' }, 503)
  }
}

export const OPTIONS = readingOptions
