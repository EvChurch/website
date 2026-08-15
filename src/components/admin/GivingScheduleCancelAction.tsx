'use client'

import { useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

type State = { phase: 'idle' } | { phase: 'ready'; nonce: string } | { phase: 'working' } | { phase: 'done'; message: string } | { phase: 'error'; message: string }

export default function GivingScheduleCancelAction() {
  const { id } = useDocumentInfo()
  const status = useFormFields(([fields]) => fields.status?.value)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<State>({ phase: 'idle' })
  if (!id || status !== 'active') return null

  async function request(body: Record<string, string>) {
    return fetch(`/api/admin/giving/schedules/${encodeURIComponent(String(id))}/cancel`, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-EV-Giving-Admin-Request': 'cancel-schedule-v1' },
      body: JSON.stringify(body),
    })
  }
  async function prepare() {
    setState({ phase: 'working' })
    try {
      const response = await request({ phase: 'prepare', reason })
      const value = await response.json() as { nonce?: string }
      if (!response.ok || !value.nonce) throw new Error('prepare')
      setState({ phase: 'ready', nonce: value.nonce })
    } catch { setState({ phase: 'error', message: 'Cancellation could not be prepared. Reload and try again.' }) }
  }
  async function confirm(nonce: string) {
    setState({ phase: 'working' })
    try {
      const response = await request({ phase: 'confirm', reason, nonce })
      const value = await response.json() as { status?: string }
      if (response.ok && value.status === 'cancelled') setState({ phase: 'done', message: 'Schedule cancelled. Future payments will stop; the enduring consent remains in place.' })
      else if (response.status === 202) setState({ phase: 'done', message: 'Cancellation is still unknown and will be reconciled automatically. Even if BlinkPay currently shows active, do not submit it again.' })
      else setState({ phase: 'error', message: 'BlinkPay did not confirm cancellation. The schedule remains recoverable; check its operation record before trying again.' })
    } catch { setState({ phase: 'error', message: 'Cancellation outcome could not be confirmed. Do not submit it again; reconcile the schedule first.' }) }
  }

  return (
    <section aria-label="Cancel recurring schedule" style={{ border: '1px solid var(--theme-elevation-150)', marginTop: '1rem', padding: '1rem' }}>
      <h3>Cancel recurring schedule</h3>
      <p>This stops future payments. It does not revoke the giver&apos;s enduring consent.</p>
      {state.phase === 'ready' ? <><p><strong>Confirm:</strong> future scheduled payments will stop, but consent remains authorised.</p><button type="button" onClick={() => void confirm(state.nonce)}>Confirm cancellation</button></> : null}
      {state.phase === 'idle' || state.phase === 'error' ? <><label htmlFor="giving-cancel-reason">Reason</label><textarea id="giving-cancel-reason" maxLength={500} minLength={3} required value={reason} onChange={(event) => setReason(event.target.value)} /><button type="button" disabled={reason.trim().length < 3} onClick={() => void prepare()}>Prepare cancellation</button></> : null}
      {state.phase === 'working' ? <p role="status">Working…</p> : null}
      {state.phase === 'done' ? <p role="status">{state.message}</p> : null}
      {state.phase === 'error' ? <p role="alert">{state.message}</p> : null}
    </section>
  )
}
