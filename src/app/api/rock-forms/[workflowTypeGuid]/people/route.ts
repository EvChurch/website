import { NextRequest, NextResponse } from 'next/server'
import { rockFetch } from '@/lib/rock-api'
import { verifyRockFormContextToken } from '@/lib/rock-forms/context-token'
import { ROCK_FIELD_TYPES } from '@/lib/rock-forms/field-types'
import { isRockFormPublished } from '@/lib/rock-forms/published'

type PersonSearchResult = {
  primaryAliasGuid?: string | null
  name?: string | null
  isActive?: boolean
  isDeceased?: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowTypeGuid: string }> },
) {
  try {
    const { workflowTypeGuid } = await params
    const origin = request.headers.get('origin')
    if (
      origin &&
      new URL(origin).host !== request.nextUrl.host
    ) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }
    const body = (await request.json()) as {
      query?: unknown
      contextToken?: unknown
    }
    const query = String(body.query || '').trim()
    const context = verifyRockFormContextToken(String(body.contextToken || ''))
    const personFieldAllowed = context.allowedFields.some(
      (field) => field.fieldTypeGuid === ROCK_FIELD_TYPES.person,
    )

    if (
      query.length < 3 ||
      query.length > 100 ||
      !personFieldAllowed ||
      context.workflowTypeGuid !== workflowTypeGuid.toLowerCase() ||
      !(await isRockFormPublished(workflowTypeGuid))
    ) {
      return NextResponse.json({ people: [] })
    }

    const results = await rockFetch<PersonSearchResult[]>({
      endpoint: 'v2/Controls/PersonPickerSearch',
      method: 'POST',
      body: {
        name: query,
        includeDetails: false,
        includeBusinesses: false,
        includeDeceased: false,
      },
      retries: 0,
    })

    return NextResponse.json({
      people: results
        .filter(
          (person) =>
            person.primaryAliasGuid &&
            person.name &&
            person.isActive !== false &&
            person.isDeceased !== true,
        )
        .slice(0, 10)
        .map((person) => ({
          value: person.primaryAliasGuid,
          text: person.name,
        })),
    })
  } catch (error) {
    console.error('Unable to search Rock people', error)
    return NextResponse.json(
      { error: 'Person search is temporarily unavailable' },
      { status: 502 },
    )
  }
}
