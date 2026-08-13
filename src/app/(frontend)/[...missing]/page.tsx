import { publicNotFound } from '@/lib/public-not-found'

export default async function MissingPublicPage({
  params,
}: {
  params: Promise<{ missing: string[] }>
}): Promise<never> {
  const { missing } = await params
  publicNotFound(...missing)
}
