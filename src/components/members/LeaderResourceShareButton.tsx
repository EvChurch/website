'use client'

import { useState } from 'react'

export function LeaderResourceShareButton({ rockId, className = '' }: { rockId: number; className?: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'manual' | 'error'>('idle')
  const [url, setUrl] = useState('')

  async function share() {
    if (state === 'loading') return
    setState('loading'); setUrl('')
    try {
      const response = await fetch(`/api/member/leader-resource-shares/${rockId}`, { method: 'POST' })
      if (!response.ok) throw new Error('share unavailable')
      const data = await response.json() as { path?: string }
      if (!data.path) throw new Error('share unavailable')
      const absoluteUrl = new URL(data.path, window.location.origin).toString()
      try {
        await navigator.clipboard.writeText(absoluteUrl)
        setState('copied')
      } catch {
        setUrl(absoluteUrl); setState('manual')
      }
    } catch {
      setState('error')
    }
  }

  return <span className="inline-flex items-center gap-2">
    <button type="button" disabled={state === 'loading'} onClick={share} className={className}>
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>
      {state === 'loading' ? 'Preparing…' : 'Share'}
    </button>
    <span aria-live="polite" className="text-xs font-normal">
      {state === 'copied' && 'Link copied'}
      {state === 'error' && 'Could not create the link. Please try again.'}
      {state === 'manual' && <label>Copy this link: <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="mt-1 block w-full min-w-64 rounded border border-current bg-white px-2 py-1 text-brand-black" /></label>}
    </span>
  </span>
}
