import { trackedNotFound } from '@/lib/tracked-not-found'

export default async function MissingPublicPage({
  params,
}: {
  params: Promise<{ missing: string[] }>
}): Promise<never> {
  const { missing } = await params
  trackedNotFound(...missing)
}
