import type { Metadata } from 'next'

import { BankTransferEmailConfirmation } from '@/components/giving/BankTransferEmailConfirmation'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title:'Confirm bank transfer setup | Ev Church',robots:{index:false,follow:false},referrer:'no-referrer' }

export default async function BankTransferConfirmPage({searchParams}:{searchParams:Promise<{token?:string}>}) {
  const {token=''}=await searchParams
  return <div className="min-h-[70vh] bg-warm-white px-4 py-16 sm:py-24"><BankTransferEmailConfirmation token={token.slice(0,180)} /></div>
}
