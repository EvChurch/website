import { useState } from 'react'
import type { PublicGivingFund } from '@/lib/giving/contracts'

export function FundStep({ funds, selected, onSelect }: { funds: readonly PublicGivingFund[]; selected: number | null; onSelect: (fund: PublicGivingFund) => void }) {
  const groupFor = (fund: PublicGivingFund) => fund.studentMinisterRelated ? 'students' : fund.apprenticeRelated ? 'apprentices' : 'general'
  const [group, setGroup] = useState<string>(() => {
    const fund = funds.find((candidate) => candidate.id === selected)
    return fund ? groupFor(fund) : 'general'
  })
  const visibleFunds = funds.filter((fund) => groupFor(fund) === group)
  const groups = [
    { key: 'apprentices', label: 'Apprentices' },
    { key: 'students', label: 'Student ministers' },
  ].filter(({ key }) => funds.some((fund) => groupFor(fund) === key))

  return <div className="space-y-3">
    {group !== 'general' && <button autoFocus type="button" onClick={() => setGroup('general')} className="min-h-14 w-full rounded-full border border-warm-grey bg-warm-grey/70 px-6 text-left font-semibold text-brand-black transition hover:border-rich-red/50 hover:bg-warm-grey hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red">Back</button>}
    <div className="space-y-3" role="radiogroup" aria-label="Giving fund">{visibleFunds.map((fund, index) => <button autoFocus={group === 'general' && index === 0} key={fund.id} type="button" role="radio" aria-checked={fund.id === selected} onClick={() => onSelect(fund)} className={`min-h-14 w-full rounded-full border bg-white px-6 text-left font-semibold transition hover:border-rich-red/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red ${fund.id === selected ? 'border-rich-red ring-2 ring-rich-red/20' : 'border-warm-grey'}`}>{fund.name}</button>)}</div>
    {group === 'general' && groups.map(({ key, label }) => <button key={key} type="button" onClick={() => setGroup(key)} className="min-h-14 w-full rounded-full border border-warm-grey bg-warm-grey/70 px-6 text-left font-semibold text-brand-black transition hover:border-rich-red/50 hover:bg-warm-grey hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red">{label}</button>)}
  </div>
}
