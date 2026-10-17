import { handleReimbursementRequest } from '@/lib/reimbursements/http'
import type { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
async function handle(request: NextRequest) { return handleReimbursementRequest(request) }
export { handle as GET, handle as POST }
