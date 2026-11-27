'use client'
import { useEffect, useState } from 'react'
import { parseCampaignReceipts, type CampaignReceipts } from '@/lib/giving/campaign-progress'

const REFRESH_EVENT = 'ev-campaign-progress-refresh'
const REFRESH_MS = 60_000
let cached: CampaignReceipts | null = null
let loadedAt = 0
let inFlight: Promise<CampaignReceipts> | null = null

async function load(force = false): Promise<CampaignReceipts> {
  if (inFlight) return inFlight
  if (!force && cached && Date.now() - loadedAt < REFRESH_MS) return cached
  inFlight = (async () => {
    const response = await fetch('/api/giving/campaign-progress', { cache: 'no-store', credentials: 'same-origin' })
    if (!response.ok) throw new Error('Campaign totals unavailable')
    const value: unknown = await response.json()
    if (!value || typeof value !== 'object' || !('receipts' in value)) throw new Error('Invalid campaign totals')
    const receipts = parseCampaignReceipts(value.receipts)
    cached = receipts
    loadedAt = Date.now()
    return receipts
  })()
  try { return await inFlight } finally { inFlight = null }
}

export function refreshCampaignReceipts() {
  loadedAt = 0
  window.dispatchEvent(new Event(REFRESH_EVENT))
}

export function useCampaignReceipts(enabled: boolean) {
  const [receipts, setReceipts] = useState<CampaignReceipts | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let active = true
    if (cached) setReceipts(cached)
    const refresh = async (force = false) => {
      try { const next = await load(force); if (active) { setReceipts(next); setUnavailable(false) } }
      catch { if (active && !cached) setUnavailable(true) }
    }
    void refresh()
    const forceRefresh = () => { void refresh(true) }
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(true) }, REFRESH_MS)
    window.addEventListener('focus', forceRefresh)
    window.addEventListener(REFRESH_EVENT, forceRefresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', forceRefresh); window.removeEventListener(REFRESH_EVENT, forceRefresh) }
  }, [enabled])
  return { receipts, unavailable }
}
