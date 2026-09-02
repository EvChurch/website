import type { GivingFrequency } from '../giving-state'

const main: Array<[GivingFrequency, string]> = [
  ['weekly', 'Every week'],
  ['fortnightly', 'Every two weeks'],
  ['monthly', 'Every month'],
  ['one-off', 'Just this once'],
]
const frequencyOptionSurface = 'min-h-14 w-full rounded-full border border-warm-grey px-6 font-semibold text-brand-black'

export function FrequencyPreview() {
  return <div aria-hidden="true" data-frequency-preview className="pointer-events-none mt-8">
    <p className="text-xl font-semibold text-brand-black">How often?</p>
    <div className="mt-4 max-h-14 overflow-hidden opacity-50 [mask-image:linear-gradient(to_bottom,#000_0%,#000_45%,transparent_100%)]">
      <div className={`${frequencyOptionSurface} flex items-center bg-white`}>{main[0][1]}</div>
    </div>
  </div>
}

export function FrequencyStep({ selected, onSelect }: { selected: GivingFrequency | null; onSelect: (frequency: GivingFrequency) => void }) {
  return <div className="space-y-3">{main.map(([value, label], index) => <button autoFocus={index === 0} key={value} type="button" onClick={() => onSelect(value)} className={`${frequencyOptionSurface} text-left transition hover:border-rich-red/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red ${value === 'one-off' ? 'bg-warm-grey/70 hover:bg-warm-grey' : 'bg-white'} ${selected === value ? 'ring-2 ring-rich-red' : ''}`}>{label}</button>)}</div>
}
