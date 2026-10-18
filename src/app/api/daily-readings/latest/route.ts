import { getDailyReadingByRockId, getLatestDailyReading } from '@/lib/daily-readings/data'
import { readingDetail, readingOptions, readingResponse } from '@/lib/daily-readings/public-api'

export async function GET() {
  try {
    const latest = await getLatestDailyReading()
    const reading = latest ? await getDailyReadingByRockId(latest.rockId) : null
    return reading
      ? readingResponse({ reading: readingDetail(reading) })
      : readingResponse({ error: 'No published daily reading found.' }, 404)
  } catch {
    console.error({ category: 'public-latest-daily-reading-failed' })
    return readingResponse({ error: 'Daily readings are temporarily unavailable.' }, 503)
  }
}

export const OPTIONS = readingOptions
