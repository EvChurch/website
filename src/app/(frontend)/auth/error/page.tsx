import { AuthAccessMessage } from '@/components/admin/AuthAccessMessage'

export const dynamic = 'force-dynamic'

export default function AuthErrorPage() {
  return (
    <AuthAccessMessage
      eyebrow="Sign-in problem"
      title="We could not complete your sign-in"
      primaryHref="/auth/login?returnTo=/admin"
      primaryLabel="Start sign-in again"
      secondaryHref="/auth/logout?returnTo=/"
      secondaryLabel="Sign out"
    >
      <p>Your account was not given access and no role was assigned.</p>
      <p>If this keeps happening, ask a Payload administrator for help.</p>
    </AuthAccessMessage>
  )
}
