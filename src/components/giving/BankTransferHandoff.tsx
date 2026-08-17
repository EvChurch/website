'use client'

import { useState } from 'react'

import type { GivingBankTransferDetails } from '@/lib/giving/bank-transfer'

const FIELDS = [
  ['account name', 'Account name', 'accountName'],
  ['account number', 'Account number', 'accountNumber'],
  ['particulars', 'Particulars', 'particulars'],
  ['code', 'Code', 'code'],
  ['reference', 'Reference', 'reference'],
] as const

export function BankTransferHandoff({
  details,
  summary,
  acknowledged,
  acknowledging,
  onAcknowledge,
}: {
  details: GivingBankTransferDetails
  summary: string
  acknowledged: boolean
  acknowledging: boolean
  onAcknowledge: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setCopyError(false)
    } catch {
      setCopied(null)
      setCopyError(true)
    }
  }

  return <div className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-warm-grey/60">
    <p className="text-sm text-dark-grey">Use these details in your banking app.</p>
    <p className="mt-2 rounded-2xl bg-warm-grey/35 px-3 py-2 text-sm font-semibold text-brand-black">{summary}</p>

    <dl className="mt-3 space-y-1.5">
      {FIELDS.map(([copyLabel, label, key]) => <div key={key} className="flex min-h-12 items-center gap-2 rounded-2xl bg-warm-grey/30 px-3 py-1.5">
        <div className="min-w-0 flex-1">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-dark-grey">{label}</dt>
          <dd className={`break-words text-sm font-semibold leading-tight text-brand-black ${key === 'accountNumber' ? 'tabular-nums' : ''}`}>{details[key]}</dd>
        </div>
        <button type="button" aria-label={`Copy ${copyLabel}`} onClick={() => void copy(copyLabel, details[key])} className="min-h-9 shrink-0 rounded-full border border-warm-grey bg-white px-3 text-xs font-semibold text-brand-black transition hover:border-rich-red hover:text-rich-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2">
          {copied === copyLabel ? 'Copied' : 'Copy'}
        </button>
      </div>)}
    </dl>
    {copyError && <p role="alert" className="mt-2 text-xs text-rich-red">Could not copy that value. Press and hold the value to copy it manually.</p>}

    {acknowledged
      ? <p role="status" className="mt-3 rounded-2xl bg-[#e8f5ec] px-3 py-2 text-sm font-semibold text-brand-black">Thanks — we&apos;ve recorded that you set this up.</p>
      : <button type="button" disabled={acknowledging} onClick={onAcknowledge} className="mt-3 min-h-12 w-full rounded-full bg-rich-red px-5 text-sm font-semibold text-white transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2 disabled:opacity-60">
          {acknowledging ? 'Recording…' : "I've set this up"}
        </button>}
  </div>
}
