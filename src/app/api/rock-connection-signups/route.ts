import { NextResponse } from 'next/server'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

export async function GET() {
  return NextResponse.json(
    { error: 'A connection signup identifier is required' },
    { status: 400, headers: NO_STORE },
  )
}
