import type { GivingFrequency } from '../giving-state'

const main: Array<[GivingFrequency, string]> = [
  ['weekly', 'Every week'],
  ['fortnightly', 'Every two weeks'],
  ['monthly', 'Every month'],
  ['one-off', 'Just this once'],
]
export function FrequencyStep({ selected, onSelect }: { selected: GivingFrequency | null; onSelect: (frequency: GivingFrequency) => void }) {
  return <div className="space-y-3">{main.map(([value, label], index) => <button autoFocus={index === 0} key={value} type="button" onClick={() => onSelect(value)} className={`min-h-14 w-full rounded-full border px-6 text-left font-semibold transition hover:border-rich-red/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red ${value === 'one-off' ? 'border-warm-grey bg-warm-grey/70 text-brand-black hover:bg-warm-grey' : 'border-warm-grey bg-white text-brand-black'} ${selected === value ? 'ring-2 ring-rich-red' : ''}`}>{label}</button>)}</div>
}
