import { useEffect, useState } from 'react'

export function AmountStep({ value, error, onContinue }: { value: number | null; error?: string; onContinue: (minor: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? '' : (value / 100).toFixed(2))
  useEffect(() => { setDraft(value === null ? '' : (value / 100).toFixed(2)) }, [value])
  const parse = (text: string) => /^(?:\d+)(?:\.\d{0,2})?$/u.test(text) ? Math.round(Number(text) * 100) : null
  return <form onSubmit={(event) => { event.preventDefault(); onContinue(parse(draft)) }} className="space-y-6">
    <label className="block"><span className="mb-3 block text-sm font-semibold text-dark-grey">NZD amount</span><div className="flex items-center rounded-2xl border border-warm-grey bg-white px-5 focus-within:border-rich-red focus-within:ring-2 focus-within:ring-rich-red/20"><span className="text-xl font-semibold">$</span><input autoFocus inputMode="decimal" aria-describedby={error ? 'giving-amount-error' : undefined} className="min-h-14 w-full bg-transparent px-3 text-2xl font-semibold outline-none" value={draft} onChange={(event) => setDraft(event.target.value)} /></div></label>
    {error && <p id="giving-amount-error" role="alert" className="text-sm text-rich-red">{error}</p>}
    <button className="min-h-12 w-full rounded-full bg-rich-red px-5 font-semibold text-white" type="submit">Continue</button>
  </form>
}
