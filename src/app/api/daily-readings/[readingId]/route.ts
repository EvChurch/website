import { getDailyReadingByRockId } from '@/lib/daily-readings/data'
import { readingDetail, readingOptions, readingResponse } from '@/lib/daily-readings/public-api'

export async function GET(_request: Request, { params }: { params: Promise<{ readingId: string }> }) {
  const { readingId } = await params
  const id = Number(readingId)
  if (!/^\d+$/.test(readingId) || !Number.isSafeInteger(id) || id < 1) {
    return readingResponse({ error: 'readingId must be a positive integer.' }, 400)
  }

  try {
    const reading = await getDailyReadingByRockId(id)
    return reading
      ? readingResponse({ reading: readingDetail(reading) })
      : readingResponse({ error: 'Published daily reading not found.' }, 404)
  } catch {
    console.error({ category: 'public-daily-reading-failed' })
    return readingResponse({ error: 'Daily readings are temporarily unavailable.' }, 503)
  }
}

export const OPTIONS = readingOptions
