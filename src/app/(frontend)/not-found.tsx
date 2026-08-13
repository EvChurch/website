import { PublicErrorExperience } from '@/components/errors/PublicErrorExperience'

export default function NotFound() {
  return (
    <PublicErrorExperience
      eyebrow="Page not found"
      title="We couldn't find that page"
      message="The page may have moved, or the link may be out of date."
      actions={[{ label: 'Return home', href: '/', variant: 'primary' }]}
    />
  )
}
