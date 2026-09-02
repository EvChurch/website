import type { GivingFrequency } from '../giving-state'

const main: Array<[GivingFrequency, string]> = [
  ['weekly', 'Every week'],
  ['fortnightly', 'Every two weeks'],
  ['monthly', 'Every month'],
  ['one-off', 'Just this once'],
]
const frequencyOptionSurface = 'min-h-14 w-full rounded-full border border-warm-grey px-6 font-semibold text-brand-black'

export function FrequencyStep({ selected, onSelect }: { selected: GivingFrequency | null; onSelect: (frequency: GivingFrequency) => void }) {
  return <div className="space-y-3">{main.map(([value, label], index) => <button autoFocus={index === 0} key={value} type="button" onClick={() => onSelect(value)} className={`${frequencyOptionSurface} text-left transition hover:border-rich-red/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red ${value === 'one-off' ? 'bg-warm-grey/70 hover:bg-warm-grey' : 'bg-white'} ${selected === value ? 'ring-2 ring-rich-red' : ''}`}>{label}</button>)}</div>
}
