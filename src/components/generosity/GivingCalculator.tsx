'use client'

import { useState } from 'react'
import {
  annualGivingTarget,
  annualTotal,
  GIVING_FREQUENCIES,
  givingPercentage,
  isValidCalculatorAmount,
  type GivingFrequency,
} from '@/lib/generosity/calculator'

interface MoneyRow {
  id: string
  label: string
  amount: string
  frequency: GivingFrequency
}

const incomeDefaults: MoneyRow[] = [
  { id: 'household', label: 'Household income before tax', amount: '', frequency: 'yearly' },
  { id: 'support', label: 'Government support', amount: '', frequency: 'fortnightly' },
  { id: 'other-income', label: 'Other income', amount: '', frequency: 'yearly' },
]
const churchDefaults: MoneyRow[] = [
  { id: 'general', label: 'General giving', amount: '', frequency: 'weekly' },
  { id: 'building', label: 'Building fund', amount: '', frequency: 'weekly' },
  { id: 'one-off', label: 'One-off giving', amount: '', frequency: 'yearly' },
]
const otherDefaults: MoneyRow[] = [
  { id: 'gospel', label: 'Other gospel work', amount: '', frequency: 'monthly' },
  { id: 'poor', label: 'Giving to the poor', amount: '', frequency: 'monthly' },
]
const money = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })
const percentage = new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 2 })
const inputClass = 'mt-2 w-full rounded-md border border-warm-grey bg-white px-3 py-3 text-base text-brand-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rich-red'

function AmountGroup({ title, description, rows, onChange }: {
  title: string
  description: string
  rows: MoneyRow[]
  onChange: (rows: MoneyRow[]) => void
}) {
  function updateRow(id: string, update: Partial<MoneyRow>) {
    onChange(rows.map((row) => row.id === id ? { ...row, ...update } : row))
  }

  return (
    <fieldset className="min-w-0 rounded-xl border border-warm-grey bg-white p-5 sm:p-8">
      <legend className="px-2 text-xl font-bold">{title}</legend>
      <p className="mb-6 text-dark-grey">{description}</p>
      <div className="space-y-5">
        {rows.map((row) => (
          <div key={row.id} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="min-w-0 text-sm font-semibold" htmlFor={`${row.id}-amount`}>
              {row.label} (NZD)
              <input id={`${row.id}-amount`} type="text" inputMode="decimal" autoComplete="off" placeholder="0" value={row.amount} aria-invalid={!isValidCalculatorAmount(row.amount)} aria-describedby={!isValidCalculatorAmount(row.amount) ? `${row.id}-error` : undefined} onChange={(event) => updateRow(row.id, { amount: event.target.value })} className={inputClass} />
              {!isValidCalculatorAmount(row.amount) && <span id={`${row.id}-error`} className="mt-2 block text-deep-red">Enter a positive amount with up to two decimal places.</span>}
            </label>
            <label className="min-w-0 text-sm font-semibold" htmlFor={`${row.id}-frequency`}>
              Frequency <span className="sr-only">for {row.label}</span>
              <select id={`${row.id}-frequency`} value={row.frequency} onChange={(event) => {
                const frequency = event.target.value
                if (frequency in GIVING_FREQUENCIES) updateRow(row.id, { frequency: frequency as GivingFrequency })
              }} className={inputClass}>
                {Object.entries(GIVING_FREQUENCIES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => onChange(rows.filter((item) => item.id !== row.id))} aria-label={`Remove ${row.label}`} className="rounded-md px-2 py-3 text-sm text-deep-red underline underline-offset-4">Remove</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...rows, { id: crypto.randomUUID(), label: `Additional amount ${rows.length + 1}`, amount: '', frequency: 'monthly' }])} className="mt-6 rounded-sm font-semibold text-deep-red underline underline-offset-4">+ Add another amount</button>
      <p className="mt-6 border-t border-warm-grey pt-4 font-semibold">Annual total: <output>{money.format(annualTotal(rows))}</output></p>
    </fieldset>
  )
}

export function GivingCalculator() {
  const [income, setIncome] = useState(incomeDefaults)
  const [church, setChurch] = useState(churchDefaults)
  const [other, setOther] = useState(otherDefaults)
  const [target, setTarget] = useState('')
  const annualIncome = annualTotal(income)
  const annualChurch = annualTotal(church)
  const annualOther = annualTotal(other)
  const giving = annualChurch + annualOther
  const currentPercentage = givingPercentage(annualIncome, giving)
  const planned = annualGivingTarget(annualIncome, target)
  const difference = planned - giving

  function reset() {
    setIncome(incomeDefaults)
    setChurch(churchDefaults)
    setOther(otherDefaults)
    setTarget('')
  }

  return (
    <div className="ph-no-capture ph-mask" data-giving-private="true">
      <p className="mb-10 rounded-xl border border-warm-grey bg-white p-5 text-dark-grey">Your figures stay in this calculator on your device. They aren’t saved or sent to us. Use Clear all figures or refresh this page to reset them. Enter amounts in NZ dollars, with up to two decimal places.</p>
      <div className="space-y-8">
        <AmountGroup title="Your income" description="Include your household income before tax, plus any other income or support." rows={income} onChange={setIncome} />
        <AmountGroup title="Your local church giving" description="What you currently give to your local church. Choose a frequency for each amount." rows={church} onChange={setChurch} />
        <AmountGroup title="Your giving beyond church" description="Include other gospel work, charities and giving to the poor." rows={other} onChange={setOther} />
      </div>

      <section aria-labelledby="giving-summary" className="mt-10 rounded-xl bg-brand-black p-6 text-white sm:p-10">
        <h2 id="giving-summary" className="text-h3 font-bold">Your giving at a glance</h2>
        <dl className="mt-8 grid gap-6 sm:grid-cols-3">
          <div><dt className="text-warm-grey">Total annual giving</dt><dd className="mt-2 text-2xl font-bold"><output data-testid="annual-giving">{money.format(giving)}</output></dd></div>
          <div><dt className="text-warm-grey">As a share of income</dt><dd className="mt-2 text-2xl font-bold"><output data-testid="giving-percentage">{currentPercentage === null ? 'Add your income' : `${percentage.format(currentPercentage)}%`}</output></dd></div>
          <div><dt className="text-warm-grey">Equivalent each week</dt><dd className="mt-2 text-2xl font-bold">{money.format(giving / 52)}</dd></div>
        </dl>
        {annualIncome > 0 && giving > annualIncome && <p className="mt-6 text-warm-white">Your giving is higher than the income entered. Check that your amounts and frequencies are correct.</p>}
      </section>

      <section aria-labelledby="next-step" className="mt-10 rounded-xl border border-warm-grey bg-white p-6 sm:p-10">
        <h2 id="next-step" className="text-h3 font-bold">What could a next step look like?</h2>
        <p className="mt-4 text-dark-grey">Try a share of your income to see what that would mean. This is a tool for reflection, not a target you need to meet.</p>
        <label htmlFor="target-percentage" className="mt-6 block max-w-xs text-sm font-semibold">Giving as a percentage of income (%)
          <input id="target-percentage" type="text" inputMode="decimal" autoComplete="off" placeholder="Choose a percentage" value={target} aria-invalid={!isValidCalculatorAmount(target)} onChange={(event) => setTarget(event.target.value)} className={inputClass} />
        </label>
        {!isValidCalculatorAmount(target) && <p className="mt-2 text-deep-red">Enter a positive percentage with up to two decimal places.</p>}
        {annualIncome > 0 && target.trim() !== '' && isValidCalculatorAmount(target) ? (
          <div className="mt-6 space-y-3 text-lg" aria-live="polite">
            <p>That would be <strong>{money.format(planned)} a year</strong>, or {money.format(planned / 52)} a week, {money.format(planned / 26)} a fortnight or {money.format(planned / 12)} a month.</p>
            <p>{difference === 0 ? 'That matches your current giving.' : `${money.format(Math.abs(difference) / 52)} ${difference > 0 ? 'more' : 'less'} per week than your current giving.`}</p>
            {planned > annualIncome && <p className="text-deep-red">This is more than the income entered. Check your percentage before using this figure.</p>}
          </div>
        ) : <p className="mt-6 text-dark-grey">Add your income and choose a percentage to explore a next step.</p>}
        <p className="mt-6 text-sm leading-relaxed text-dark-grey">Eligible gifts to registered NZ charities can qualify for a donation tax credit of one third. Eligibility and income limits apply; not every gift entered here will qualify.</p>
      </section>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-dark-grey">If money is tight, please don’t read this as pressure. Speak with your Connect Group leader or contact us if you’d like support.</p>
        <button type="button" onClick={reset} className="rounded-md border border-rich-red px-6 py-3 font-semibold text-deep-red">Clear all figures</button>
      </div>
    </div>
  )
}
