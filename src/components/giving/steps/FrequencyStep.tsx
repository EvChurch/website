import { useState } from 'react'
import type { GivingFrequency } from '../giving-state'

const main: Array<[GivingFrequency, string, string]> = [
  ['monthly', 'Monthly', 'A simple rhythm for ongoing generosity'],
  ['weekly', 'Weekly', 'Give each week'],
  ['fortnightly', 'Fortnightly', 'Give every two weeks'],
  ['one-off', 'One-off gift', 'Give once today'],
]
export function FrequencyStep({ selected, onSelect }: { selected: GivingFrequency | null; onSelect: (frequency: GivingFrequency) => void }) {
  const [more, setMore] = useState(false)
  return <div className="space-y-3">{main.map(([value, label, copy], index) => <button key={value} type="button" onClick={() => onSelect(value)} className={`w-full rounded-2xl border bg-white px-5 text-left ${index === 0 ? 'min-h-20 border-rich-red/50 shadow-sm' : 'min-h-14 border-warm-grey'} ${selected === value ? 'ring-2 ring-rich-red' : ''}`}><span className="block font-semibold">{label}</span><span className="block text-sm text-dark-grey">{copy}</span></button>)}
    <button type="button" className="min-h-11 px-2 text-sm font-semibold text-rich-red" aria-expanded={more} onClick={() => setMore((value) => !value)}>More options</button>
    {more && <div className="grid grid-cols-2 gap-3">{([['daily', 'Daily'], ['annual', 'Annually']] as const).map(([value, label]) => <button key={value} type="button" className="min-h-12 rounded-2xl border border-warm-grey bg-white font-semibold" onClick={() => onSelect(value)}>{label}</button>)}</div>}
  </div>
}
