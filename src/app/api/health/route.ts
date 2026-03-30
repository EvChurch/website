import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'

export async function GET() {
  try {
    const payload = await getPayloadClient()
    await payload.find({ collection: 'pages', limit: 1, depth: 0, select: { slug: true } })
  } catch {
    return NextResponse.json({ status: 'error', reason: 'database' }, { status: 503 })
  }

  const mem = process.memoryUsage()
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
  })
}
