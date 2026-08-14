'use client'

import { useAuth } from '@payloadcms/ui'

import type { User } from '@/payload-types'

export default function MemberImpersonationNavLink() {
  const { user } = useAuth<User>()
  if (!user?.roles?.includes('admin')) return null

  return (
    <a className="member-impersonation-nav-link" href="/admin/impersonate">
      Impersonate user
    </a>
  )
}
