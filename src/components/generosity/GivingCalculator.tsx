'use client'

import { useState } from 'react'
import {
  annualTotal,
  GIVING_FREQUENCIES,
  givingPercentage,
  isValidCalculatorAmount,
  type GivingFrequency,
} from '@/lib/generosity/calculator'
import { GivingChart } from './GivingChart'
import { GivingRecommendations } from './GivingRecommendations'
import { GivingPlan } from './GivingPlan'

export interface MoneyRow {
  id: string
  label: string
  amount: string
  frequency: GivingFrequency
  custom?: boolean
}
const incomeDefaults: MoneyRow[] = [
  {
    id: 'household',
    label: 'Household income before tax',
    amount: '',
    frequency: 'yearly',
  },
  {
    id: 'support',
    label: 'Government support',
    amount: '',
    frequency: 'fortnightly',
  },
  {
    id: 'other-income',
    label: 'Other income',
    amount: '',
    frequency: 'yearly',
  },
]
const churchDefaults: MoneyRow[] = [
  { id: 'general', label: 'General Giving', amount: '', frequency: 'weekly' },
  { id: 'building', label: 'Building Fund', amount: '', frequency: 'weekly' },
  { id: 'one-off', label: 'One-Off Giving', amount: '', frequency: 'yearly' },
]
const otherDefaults: MoneyRow[] = [
  { id: 'apprentice', label: 'Apprentice', amount: '', frequency: 'monthly' },
  { id: 'sponsor', label: 'Sponsor Child', amount: '', frequency: 'monthly' },
]
const money = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  maximumFractionDigits: 0,
})
const percentage = new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 1 })
const inputClass =
  'w-full min-w-0 rounded-md border border-warm-grey bg-white px-3 py-3 text-base text-brand-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rich-red'
const tips: Record<string, string> = {
  household:
    'Place your total household income before tax in here. The amount greyed out is the median Auckland household income. Select the frequency that suits.',
  support:
    'Put in here any income you get from Working for Families or other government support.',
  apprentice:
    'Support you give to a ministry apprentice goes here, not in your Ev giving.',
}

function AmountGroup({
  title,
  description,
  totalLabel,
  rows,
  onChange,
  kind,
}: {
  title: string
  description?: string
  totalLabel: string
  rows: MoneyRow[]
  onChange: (rows: MoneyRow[]) => void
  kind: 'income' | 'church' | 'outside'
}) {
  const [editing, setEditing] = useState<string | null>(null)
  function updateRow(id: string, update: Partial<MoneyRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...update } : row)))
  }
  const fallback = kind === 'income' ? 'Other income' : 'Other gift'
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 flex items-center gap-2 text-xl font-bold">
        {kind !== 'income' && (
          <span
            aria-hidden="true"
            className={`h-3 w-3 rounded-full ${kind === 'church' ? 'bg-rich-red' : 'bg-[#083F3B]'}`}
          />
        )}
        {title}
      </legend>
      {description && (
        <p className="mb-5 text-sm text-dark-grey">{description}</p>
      )}
      <div className="space-y-5">
        {rows.map((row) => {
          const name = row.label.trim() || fallback
          const invalid = !isValidCalculatorAmount(row.amount)
          return (
            <div
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.7fr)_auto] items-end gap-x-2 gap-y-2"
            >
              <div className="relative col-span-3 flex items-center gap-2 text-sm font-semibold">
                {row.custom && (editing === row.id || !row.label) ? (
                  <input
                    autoFocus
                    aria-label={
                      kind === 'income' ? 'Income name' : 'Who is it for?'
                    }
                    placeholder={
                      kind === 'income' ? 'Income name' : 'Who is it for?'
                    }
                    value={row.label}
                    onChange={(e) =>
                      updateRow(row.id, { label: e.target.value })
                    }
                    onBlur={() => setEditing(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    className={inputClass}
                  />
                ) : (
                  <>
                    <label htmlFor={`${row.id}-amount`}>{name}</label>
                    {row.custom && (
                      <button
                        type="button"
                        aria-label={`Edit ${name} name`}
                        onClick={() => setEditing(row.id)}
                        className="px-2 text-deep-red"
                      >
                        ✎
                      </button>
                    )}
                  </>
                )}
                {tips[row.id] && (
                  <details>
                    <summary
                      aria-label={`About ${name}`}
                      className="cursor-pointer list-none rounded-full border border-warm-grey px-2 text-dark-grey"
                    >
                      i
                    </summary>
                    <p className="absolute left-0 z-10 mt-2 w-64 max-w-full rounded-lg border border-warm-grey bg-white p-3 text-sm font-normal shadow-lg">
                      {tips[row.id]}
                    </p>
                  </details>
                )}
              </div>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-3 left-3 text-dark-grey"
                >
                  $
                </span>
                <input
                  aria-label={`${name} amount`}
                  id={`${row.id}-amount`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={
                    row.id === 'household'
                      ? `${(117000 / GIVING_FREQUENCIES[row.frequency].periods).toLocaleString('en-NZ')} (Auckland median)`
                      : '0'
                  }
                  value={row.amount}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${row.id}-error` : undefined}
                  onChange={(e) =>
                    updateRow(row.id, { amount: e.target.value })
                  }
                  className={`${inputClass} pl-7 placeholder:text-neutral-400`}
                />
              </div>
              <select
                aria-label={`Frequency for ${name}`}
                id={`${row.id}-frequency`}
                value={row.frequency}
                onChange={(e) => {
                  const frequency = e.target.value
                  if (frequency in GIVING_FREQUENCIES)
                    updateRow(row.id, {
                      frequency: frequency as GivingFrequency,
                    })
                }}
                className={inputClass}
              >
                {Object.entries(GIVING_FREQUENCIES).map(([value, item]) => (
                  <option key={value} value={value}>
                    {item.label}
                  </option>
                ))}
              </select>
              {row.custom ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange(rows.filter((item) => item.id !== row.id))
                  }
                  aria-label={`Remove ${name}`}
                  className="px-2 py-3 text-deep-red"
                >
                  ×
                </button>
              ) : (
                <span />
              )}
              {invalid && (
                <p
                  id={`${row.id}-error`}
                  className="col-span-3 text-sm text-deep-red"
                >
                  Enter a positive amount with up to two decimal places.
                </p>
              )}
            </div>
          )
        })}
      </div>
      {kind !== 'church' && (
        <button
          type="button"
          onClick={() => {
            const id = crypto.randomUUID()
            onChange([
              ...rows,
              { id, label: '', amount: '', frequency: 'monthly', custom: true },
            ])
            setEditing(id)
          }}
          className="mt-5 font-semibold text-deep-red underline underline-offset-4"
        >
          {kind === 'income' ? '+ Add another income' : '+ Add another gift'}
        </button>
      )}
      <p className="mt-5 flex flex-wrap justify-between gap-2 border-t border-warm-grey pt-4 text-sm font-semibold">
        <span>{totalLabel}</span>
        <span>
          <output>{money.format(annualTotal(rows))}</output> / year
        </span>
      </p>
    </fieldset>
  )
}

export function GivingCalculator() {
  const [income, setIncome] = useState(incomeDefaults)
  const [church, setChurch] = useState(churchDefaults)
  const [other, setOther] = useState(otherDefaults)
  const [visit, setVisit] = useState(0)
  const annualIncome = annualTotal(income),
    annualChurch = annualTotal(church),
    annualOther = annualTotal(other)
  const giving = annualChurch + annualOther
  const currentPercentage = givingPercentage(annualIncome, giving)
  const progress =
    8 +
    (annualIncome > 0 ? 34 : 0) +
    (giving > 0 ? 34 : 0) +
    (annualIncome > 0 && giving > 0 ? 24 : 0)
  return (
    <div className="ph-no-capture ph-mask" data-giving-private="true">
      <div
        role="progressbar"
        aria-label="Calculator progress"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mb-6 h-1.5 overflow-hidden rounded-full bg-warm-grey"
      >
        <div
          className="h-full bg-rich-red transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mb-8 text-sm text-dark-grey">
        Your figures stay on your device. Refresh or clear to reset.
      </p>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <div className="rounded-xl border border-warm-grey bg-white p-5 sm:p-7">
            <AmountGroup
              kind="income"
              title="Your household income"
              description="Before tax, from every source. Set the frequency that matches how you think about each one."
              totalLabel="Total income before tax"
              rows={income}
              onChange={setIncome}
            />
          </div>
          <section
            className="space-y-8 rounded-xl border border-warm-grey bg-white p-5 sm:p-7"
            aria-labelledby="current-giving"
          >
            <div>
              <h2 id="current-giving" className="text-2xl font-bold">
                Your current giving
              </h2>
              <p className="mt-2 text-sm text-dark-grey">
                What you actually give right now — each gift at its own
                frequency.
              </p>
            </div>
            <AmountGroup
              kind="church"
              title="Ev giving"
              totalLabel="Total local church giving"
              rows={church}
              onChange={setChurch}
            />
            <AmountGroup
              kind="outside"
              title="Outside Ev giving"
              description="Apprentices you support, sponsored children, other gospel work, charities and giving to the poor."
              totalLabel="Total outside church giving"
              rows={other}
              onChange={setOther}
            />
          </section>
        </div>
        <aside className="space-y-6 lg:sticky lg:top-24">
          <GivingChart church={church} other={other} />
          <section
            aria-labelledby="giving-now"
            className="rounded-xl border border-warm-grey bg-white p-6"
          >
            <h2 id="giving-now" className="font-bold">
              My giving right now
            </h2>
            <p className="mt-3 text-4xl font-bold text-rich-red">
              <output data-testid="giving-percentage">
                {currentPercentage === null
                  ? money.format(giving)
                  : `${percentage.format(currentPercentage)}%`}
              </output>
            </p>
            <p className="mt-1 text-sm">
              {currentPercentage === null ? 'a year' : 'of my income'}
            </p>
            <p className="mt-3 text-sm text-dark-grey">
              {currentPercentage !== null && (
                <>
                  <output data-testid="annual-giving">
                    {money.format(giving)}
                  </output>{' '}
                  a year ·{' '}
                </>
              )}
              {money.format(giving / 52)} a week
              {currentPercentage === null &&
                ' · add your income above to see your percentage'}
            </p>
            {annualChurch > 0 && (
              <p className="mt-4 text-xs text-dark-grey">
                With the NZ donation tax credit, your Ev giving of{' '}
                {money.format(annualChurch)} effectively costs{' '}
                {money.format((annualChurch * 2) / 3)} after the 33.33% rebate.
                Eligibility and income limits apply.
              </p>
            )}
            {annualIncome > 0 && giving > annualIncome && (
              <p className="mt-3 text-sm text-deep-red">
                Your giving exceeds your income. Check your amounts and
                frequencies.
              </p>
            )}
          </section>
        </aside>
      </div>
      <GivingRecommendations
        annualIncome={annualIncome}
        annualChurch={annualChurch}
        annualOther={annualOther}
      />
      <GivingPlan
        key={visit}
        annualIncome={annualIncome}
        annualChurch={annualChurch}
        annualOther={annualOther}
        churchFrequency={church[0].frequency}
        outsideFrequency={
          other.reduce<MoneyRow | undefined>(
            (best, row) =>
              !best || annualTotal([row]) > annualTotal([best]) ? row : best,
            undefined,
          )?.frequency ?? 'yearly'
        }
      />
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-dark-grey">
          If money is tight, speak with your Connect Group leader or{' '}
          <a href="/contact" className="underline">
            contact us
          </a>{' '}
          for support.
        </p>
        <button
          type="button"
          onClick={() => {
            setIncome(incomeDefaults)
            setChurch(churchDefaults)
            setOther(otherDefaults)
            setVisit((v) => v + 1)
          }}
          className="rounded-md border border-rich-red px-5 py-3 font-semibold text-deep-red"
        >
          Clear all figures
        </button>
      </div>
    </div>
  )
}
