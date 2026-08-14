import { createOpenGraphImageResponse } from '@/components/seo/OpenGraphImage'

export const dynamic = 'force-static'

export function GET() {
  return createOpenGraphImageResponse()
}
