import { useEffect, useState } from 'react'
import { HiArrowRight } from 'react-icons/hi2'

export function AmountStep({ value, error, onContinue }: { value: number | null; error?: string; onContinue: (minor: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? '' : (value / 100).toFixed(2))
  useEffect(() => { setDraft(value === null ? '' : (value / 100).toFixed(2)) }, [value])
  const parse = (text: string) => /^(?:\d+)(?:\.\d{0,2})?$/u.test(text) ? Math.round(Number(text) * 100) : null
  const amountMinor = parse(draft)
  const canContinue = amountMinor !== null && amountMinor >= 100
  return <form onSubmit={(event) => { event.preventDefault(); onContinue(canContinue ? amountMinor : null) }} className="space-y-4">
    <label className="block"><span className="sr-only">NZD amount</span><div className="flex min-h-28 items-center rounded-[2rem] bg-white px-6 shadow-sm ring-1 ring-warm-grey/70 transition focus-within:ring-2 focus-within:ring-rich-red"><span className="text-4xl font-semibold text-brand-black">$</span><input autoFocus inputMode="decimal" placeholder="1.00" aria-describedby={`giving-amount-fee${error ? ' giving-amount-error' : ''}`} className="min-w-0 flex-1 bg-transparent px-3 text-4xl font-semibold text-brand-black outline-none placeholder:text-warm-grey" value={draft} onChange={(event) => { if (/^\d*(?:\.\d{0,2})?$/u.test(event.target.value)) setDraft(event.target.value) }} />{canContinue && <button className="flex h-14 w-14 shrink-0 animate-scale-in items-center justify-center rounded-full bg-rich-red text-white shadow-sm transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2 motion-reduce:animate-none" type="submit" aria-label="Continue"><HiArrowRight className="h-7 w-7" aria-hidden="true" /><span className="sr-only">Continue</span></button>}</div></label>
    <p id="giving-amount-fee" className="text-sm text-dark-grey">+$0.50 transaction fee.</p>
    {error && <p id="giving-amount-error" role="alert" className="text-sm text-rich-red">{error}</p>}
  </form>
}
