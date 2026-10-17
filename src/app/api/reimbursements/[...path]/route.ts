import type { NextRequest } from 'next/server'
import { handleReimbursementRequest } from '@/lib/reimbursements/http'
export const dynamic = 'force-dynamic'
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleReimbursementRequest(request, (await context.params).path)
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT }
