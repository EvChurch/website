'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { hasExactPayloadAdminRole } from '@/access/roles'
import type { User } from '@/payload-types'

export default function ReimbursementSettingsNavLink() {
  const { user } = useAuth<User>()
  const admin = hasExactPayloadAdminRole(user)
  const [finance, setFinance] = useState(false)
  useEffect(() => {
    let current = true
    setFinance(false)
    if (user && !admin) void fetch('/api/reimbursements/settings', { cache: 'no-store' }).then(response => { if (current) setFinance(response.ok) }).catch(() => undefined)
    return () => { current = false }
  }, [user, admin])
  return admin || finance ? <Link href="/admin/reimbursement-settings">Reimbursement settings</Link> : null
}
