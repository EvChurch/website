import { headers } from 'next/headers'
import { after } from 'next/server'

import { PublicErrorExperience } from '@/components/errors/PublicErrorExperience'
import { recordMissingPublicPath } from '@/lib/missing-paths'
import { isEligiblePublicPath, PUBLIC_PATH_HEADER } from '@/lib/public-paths'

export default async function NotFound() {
  const path = (await headers()).get(PUBLIC_PATH_HEADER)
  if (path && isEligiblePublicPath(path)) {
    after(async () => {
      await recordMissingPublicPath(path)
    })
  }

  return (
    <PublicErrorExperience
      eyebrow="Page not found"
      title="We couldn't find that page"
      message="The page may have moved, or the link may be out of date."
      actions={[{ label: 'Return home', href: '/', variant: 'primary' }]}
    />
  )
}
