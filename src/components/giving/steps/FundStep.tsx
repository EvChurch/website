import type { PublicGivingFund } from '@/lib/giving/contracts'

export function FundStep({ funds, selected, onSelect }: { funds: readonly PublicGivingFund[]; selected: number | null; onSelect: (fund: PublicGivingFund) => void }) {
  return <div className="space-y-3" role="radiogroup" aria-label="Giving fund">{funds.map((fund) => <button key={fund.id} type="button" role="radio" aria-checked={fund.id === selected} onClick={() => onSelect(fund)} className={`min-h-14 w-full rounded-2xl border bg-white px-5 text-left font-semibold ${fund.id === selected ? 'border-rich-red ring-2 ring-rich-red/20' : 'border-warm-grey'}`}>{fund.name}</button>)}</div>
}
