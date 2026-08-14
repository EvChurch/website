'use client'

import { Link, useAuth } from '@payloadcms/ui'

import type { User } from '@/payload-types'

export default function MemberImpersonationNavLink() {
  const { user } = useAuth<User>()
  if (!user?.roles?.includes('admin')) return null

  return (
    <Link className="nav__link" href="/admin/impersonate" prefetch={false}>
      <span className="nav__link-label">Impersonate user</span>
    </Link>
  )
}
