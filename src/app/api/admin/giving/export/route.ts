import { NextResponse, type NextRequest } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { hasExactPayloadAdminRole } from '@/access/roles'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { givingFinanceCsv } from '@/lib/giving/finance-export'
import { GIVING_PRIVATE_HEADERS } from '@/lib/giving/request-boundary'
import type { User } from '@/payload-types'

export const dynamic='force-dynamic'
export async function GET(request:NextRequest) {
  const payload=await getPayloadClient()
  const {user}=await payload.auth({headers:request.headers})
  if(!user || !hasExactPayloadAdminRole(user as User))return new NextResponse(null,{status:404,headers:GIVING_PRIVATE_HEADERS})
  const nzToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const from=request.nextUrl.searchParams.get('from')??`${nzToday.slice(0,7)}-01`
  const to=request.nextUrl.searchParams.get('to')??nzToday
  try {
    const csv=await givingFinanceCsv(requireGivingPostgresPool(payload),from,to)
    return new NextResponse(csv,{headers:{...GIVING_PRIVATE_HEADERS,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="ev-giving-${from}-${to}.csv"`}})
  } catch {return NextResponse.json({error:'Could not export. Choose a valid date range of at most one year, with no more than 25,000 gifts.'},{status:400,headers:GIVING_PRIVATE_HEADERS})}
}
