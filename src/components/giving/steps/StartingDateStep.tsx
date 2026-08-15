import type { GivingFrequency } from '../giving-state'
import { assertFixedRecurringPaymentInput } from '@/lib/giving/blinkpay/validation'

function nzDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
function addCalendarDays(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function isGivingStartDateValid(frequency: GivingFrequency, amountMinor: number, startDate: string, now = new Date()) {
  if (frequency === 'one-off') return false
  try {
    assertFixedRecurringPaymentInput({ consentStatus: 'Authorised', period: frequency, startDate, amountMinor, maximumAmountPaymentMinor: amountMinor, maximumAmountPeriodMinor: amountMinor }, now)
    return true
  } catch { return false }
}

export function givingDateOptions(frequency: GivingFrequency, amountMinor: number, now = new Date()) {
  const today = nzDate(now)
  return [
    { days: 0, label: 'Today' },
    { days: 1, label: 'Tomorrow' },
    { days: 7, label: 'In 7 days' },
    { days: 14, label: 'In 14 days' },
  ].map(({ days, label }) => ({ value: addCalendarDays(today, days), label }))
    .filter(({ value }) => isGivingStartDateValid(frequency, amountMinor, value, now))
}
export function StartingDateStep({ value, frequency, amountMinor, onSelect, onInvalid }: { value: string | null; frequency: GivingFrequency; amountMinor: number; onSelect: (date: string) => void; onInvalid: () => void }) {
  const now = new Date()
  const choose = (date: string) => isGivingStartDateValid(frequency, amountMinor, date, now) ? onSelect(date) : onInvalid()
  return <div className="space-y-3">{givingDateOptions(frequency, amountMinor, now).map((option) => <button key={option.value} type="button" onClick={() => choose(option.value)} className={`min-h-14 w-full rounded-2xl border bg-white px-5 text-left font-semibold ${value === option.value ? 'border-rich-red ring-2 ring-rich-red/20' : 'border-warm-grey'}`}><span>{option.label}</span><span className="ml-2 text-sm font-normal text-dark-grey">{option.value}</span></button>)}<label className="block rounded-2xl border border-warm-grey bg-white p-4"><span className="mb-2 block text-sm font-semibold">Choose another date</span><input className="min-h-11 w-full bg-transparent" type="date" min={nzDate(now)} value={value ?? ''} onChange={(event) => event.target.value && choose(event.target.value)} /></label></div>
}
