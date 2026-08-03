import { NextResponse } from 'next/server'
import { listPublicRockForms } from '@/lib/rock-forms/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ forms: await listPublicRockForms() })
  } catch (error) {
    console.error('Unable to list Rock forms', error)
    return NextResponse.json(
      { error: 'Unable to load Rock forms' },
      { status: 502 },
    )
  }
}
