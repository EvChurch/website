'use client'

import { useEffect, useState } from 'react'
import { GIVE_SUNDAY_PUBLIC_OPENS_AT } from '@/lib/giving/campaign-access'

/** UI hint only. The checkout endpoint independently rechecks server authorization. */
export function useCampaignGivingAccess(enabled: boolean) {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function refresh() {
      try {
        const response = await fetch('/api/giving/campaign-access', { cache: 'no-store', credentials: 'same-origin' })
        const access: unknown = response.ok ? await response.json() : null
        if (!cancelled) setAllowed(typeof access === 'object' && access !== null && 'allowed' in access && access.allowed === true)
      } catch { if (!cancelled) setAllowed(false) }
    }
    void refresh()
    const untilOpening = Date.parse(GIVE_SUNDAY_PUBLIC_OPENS_AT) - Date.now()
    if (untilOpening > 0) timer = setTimeout(() => void refresh(), Math.min(untilOpening + 1000, 2_147_000_000))
    window.addEventListener('focus', refresh)
    return () => { cancelled = true; if (timer) clearTimeout(timer); window.removeEventListener('focus', refresh) }
  }, [enabled])
  return enabled && allowed
}
