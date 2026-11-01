'use client'
import { useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { CheckoutElementsProvider, ExpressCheckoutElement, PaymentElement, useCheckoutElements } from '@stripe/react-stripe-js/checkout'

function CardForm({ recurring, onComplete }: { recurring:boolean; onComplete:()=>void }) {
  const result=useCheckoutElements()
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string>()
  async function pay(event?:Parameters<Extract<ReturnType<typeof useCheckoutElements>,{type:'success'}>['checkout']['confirm']>[0]) {
    if(result.type!=='success' || busy)return
    setBusy(true);setError(undefined)
    try {
      const response=await result.checkout.confirm({...event,redirect:'if_required'})
      if(response.type==='error')setError(response.error.message)
      else onComplete()
    } catch {setError('We could not confirm the payment outcome. Keep this page open while we check.');onComplete()}
    finally {setBusy(false)}
  }
  if(result.type==='loading')return <p role="status">Loading secure card details…</p>
  if(result.type==='error')return <p role="alert">We could not load secure card entry. Reload to check your gift before trying again.</p>
  return <form onSubmit={event=>{event.preventDefault();void pay()}}>
    <ExpressCheckoutElement onConfirm={event=>void pay({expressCheckoutConfirmEvent:event})} />
    <div className="mt-4"><PaymentElement /></div>
    {error && <p role="alert" className="mt-3 text-rich-red">{error}</p>}
    <button type="submit" disabled={busy} className="mt-5 min-h-14 w-full rounded-full bg-rich-red px-5 font-semibold text-white disabled:opacity-50">{busy?'Confirming…':recurring?'Set up recurring gift':'Give now'}</button>
  </form>
}

export function StripeGivingCheckout({publishableKey,clientSecret,recurring,onComplete}:{publishableKey:string;clientSecret:string;recurring:boolean;onComplete:()=>void}) {
  const stripe=useMemo(()=>loadStripe(publishableKey),[publishableKey])
  const options=useMemo(()=>({clientSecret,elementsOptions:{appearance:{variables:{colorPrimary:'#E22A30',fontFamily:'Albert Sans, sans-serif',borderRadius:'12px'}}}}),[clientSecret])
  return <CheckoutElementsProvider stripe={stripe} options={options}><CardForm recurring={recurring} onComplete={onComplete} /></CheckoutElementsProvider>
}
