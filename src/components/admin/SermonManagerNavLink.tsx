'use client'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { hasSermonManagerRole } from '@/access/roles'
import type { User } from '@/payload-types'

export default function SermonManagerNavLink() {
  const { user } = useAuth<User>()
  if (!hasSermonManagerRole(user)) return null
  return <Link href="/admin/sermon-manager">Sermon Manager</Link>
}
