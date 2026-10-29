import type { NextRequest } from 'next/server'
import { handleApiRequest } from '@/lib/reimbursements/api/http'
export const dynamic = 'force-dynamic'
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleApiRequest(request,(await context.params).path)
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE }
