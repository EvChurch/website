'use client'

import { PublicErrorExperience } from '@/components/errors/PublicErrorExperience'

export default function PublicError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <PublicErrorExperience
      eyebrow="Something went wrong"
      title="We couldn't load this page"
      message="Please try again. If the problem continues, you can return home."
      actions={[
        { label: 'Try again', onClick: retry, variant: 'primary' },
        { label: 'Return home', href: '/', variant: 'secondary' },
      ]}
    />
  )
}
