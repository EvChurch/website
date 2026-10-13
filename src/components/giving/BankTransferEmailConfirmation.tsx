'use client'

import { useState } from 'react'

import { GIVING_REQUEST_MARKERS } from '@/lib/giving/contracts'
import { GivingCompletion } from './GivingCompletion'

export function BankTransferEmailConfirmation({ token }: { token: string }) {
  const [state,setState]=useState<'ready'|'submitting'|'complete'|'error'>(token ? 'ready' : 'error')
  const confirm=async()=>{
    if(state!=='ready'&&state!=='error')return
    setState('submitting')
    try{
      const response=await fetch('/api/giving/bank-transfer/acknowledge-email',{method:'POST',headers:{'content-type':'application/json','x-ev-giving-request':GIVING_REQUEST_MARKERS.bankTransferEmailAcknowledgement},body:JSON.stringify({token})})
      const value=await response.json() as {acknowledged?:unknown;verified?:unknown}
      setState(response.ok&&value.acknowledged===true&&value.verified===false?'complete':'error')
    }catch{setState('error')}
  }
  if(state==='complete')return <GivingCompletion kind="bank-transfer" onDone={()=>window.location.assign('/give')} />
  return <article className="mx-auto max-w-lg rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-warm-grey/60">
    <h1 className="text-3xl font-semibold text-brand-black">Confirm your bank transfer setup</h1>
    <p className="mt-4 leading-relaxed text-dark-grey">If you’ve set up the transfer in your banking app, confirm it here. This records your setup; it does not verify that a payment has reached Ev.</p>
    {state==='error'&&<p role="alert" className="mt-4 text-sm text-rich-red">This confirmation link is invalid or has expired. You can prepare fresh bank details from the Give page.</p>}
    <button type="button" disabled={state==='submitting'||!token} onClick={()=>void confirm()} className="mt-6 min-h-14 w-full rounded-full bg-rich-red px-5 font-semibold text-white transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2 disabled:opacity-60">{state==='submitting'?'Recording…':"I've set this up"}</button>
  </article>
}
