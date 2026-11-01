import { apiDocumentation } from '@/lib/api/docs'

export const runtime = 'nodejs'
export async function GET(_request: Request, context: { params: Promise<{ path?: string[] }> }) {
  return apiDocumentation((await context.params).path)
}
