'use client'

import { useId, useRef, useState } from 'react'
import { HiTrash } from 'react-icons/hi2'
import { CalculatorFrequency } from './CalculatorFrequency'
import { CalculatorInfo } from './CalculatorInfo'
import {
  annualTotal,
  givingPercentage,
  isValidCalculatorAmount,
  type GivingFrequency,
} from '@/lib/generosity/calculator'
import { IncomeCalculator } from './IncomeCalculator'
import { WorkingForFamilies } from './WorkingForFamilies'
import {
  DEFAULT_FAMILY_SUPPORT,
  familySupportResult,
} from '@/lib/generosity/working-for-families'
import {
  DEFAULT_TAX_SETTINGS,
  newEarner,
  takeHome,
  validTaxSettings,
} from '@/lib/generosity/take-home'
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
    id: 'other-income',
    label: 'Other income (after tax)',
    amount: '',
    frequency: 'yearly',
  },
]
const churchDefaults: MoneyRow[] = [
  { id: 'general', label: 'General Fund', amount: '', frequency: 'weekly' },
  { id: 'building', label: 'Investment Fund', amount: '', frequency: 'weekly' },
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
  const rowId = useId()
  const nextRow = useRef(0)
  function updateRow(id: string, update: Partial<MoneyRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...update } : row)))
  }
  const fallback = kind === 'income' ? 'Other income' : 'Other gift'
  return (
    <fieldset className="min-w-0">
      <legend
        className={
          kind === 'income'
            ? 'sr-only'
            : 'mb-2 flex items-center gap-2 text-xl font-bold'
        }
      >
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
                {row.custom ? (
                  <input
                    autoFocus
                    aria-label={
                      kind === 'income' ? 'Income name' : 'Who is it for?'
                    }
                    placeholder={
                      kind === 'income' ? 'Income name' : 'Who is it for?'
                    }
                    value={row.label}
                    onChange={(event) =>
                      updateRow(row.id, { label: event.target.value })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent p-0 text-sm font-semibold text-brand-black placeholder:text-mid-grey hover:border-warm-grey focus:border-rich-red focus:outline-none"
                  />
                ) : (
                  <label htmlFor={`${row.id}-amount`}>{name}</label>
                )}
                {tips[row.id] && (
                  <CalculatorInfo name={name}>{tips[row.id]}</CalculatorInfo>
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
                  placeholder={'0'}
                  value={row.amount}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${row.id}-error` : undefined}
                  onChange={(e) =>
                    updateRow(row.id, { amount: e.target.value })
                  }
                  className={`${inputClass} pl-7 placeholder:text-neutral-400`}
                />
              </div>
              <CalculatorFrequency
                id={`${row.id}-frequency`}
                label={`Frequency for ${name}`}
                value={row.frequency}
                onChange={(frequency) => updateRow(row.id, { frequency })}
              />
              {row.custom || row.id === 'sponsor' || row.id === 'other-income' ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange(rows.filter((item) => item.id !== row.id))
                  }
                  aria-label={`Remove ${name}`}
                  title={`Remove ${name}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-mid-grey hover:bg-warm-white hover:text-rich-red focus-visible:outline-2 focus-visible:outline-rich-red"
                >
                  <HiTrash className="size-5" aria-hidden="true" />
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
            const id = `${rowId}-${nextRow.current++}`
            onChange([
              ...rows,
              { id, label: '', amount: '', frequency: 'monthly', custom: true },
            ])
          }}
          className="mt-5 font-semibold text-deep-red underline underline-offset-4"
        >
          {kind === 'income' ? '+ Add another income' : '+ Add another gift'}
        </button>
      )}
      <p
        className={`mt-5 flex flex-wrap justify-between gap-2 text-sm font-semibold ${kind === 'income' ? '' : 'border-t border-warm-grey pt-4'}`}
      >
        <span>{totalLabel}</span>
        <span>
          <output>{money.format(annualTotal(rows))}</output>
        </span>
      </p>
    </fieldset>
  )
}

export function GivingCalculator() {
  const [earners, setEarners] = useState([newEarner('household')])
  const [familySupport, setFamilySupport] = useState(DEFAULT_FAMILY_SUPPORT)
  const [taxSettings, setTaxSettings] = useState(DEFAULT_TAX_SETTINGS)
  const [income, setIncome] = useState(incomeDefaults)
  const [church, setChurch] = useState(churchDefaults)
  const [other, setOther] = useState(otherDefaults)
  const [giveTaxRefund, setGiveTaxRefund] = useState(false)
  function householdContext(salaries: ReturnType<typeof takeHome>[]) {
    const gross = salaries.reduce((total, salary) => total + salary.gross, 0)
    return {
      gross: gross + annualTotal(income),
      salaryGross: gross,
      couple: earners.length > 1,
      afterIncomeTax: salaries.reduce(
        (total, salary) => total + salary.gross - salary.paye - salary.credit,
        annualTotal(income),
      ),
      hours: gross > 0 ? taxSettings.hours : 0,
    }
  }
  let creditMonths = 12
  let salaries = earners.map((earner) =>
    takeHome(earner, taxSettings, creditMonths),
  )
  let familyIncomeContext = householdContext(salaries)
  let supportResult = familySupportResult(familySupport, familyIncomeContext)
  // Family support determines IETC eligibility; after-tax entries also use that
  // eligibility to infer gross wages. Recalculate when eligible months change.
  for (let i = 0; i < 14; i++) {
    const eligibleMonths = supportResult?.creditMonths ?? 0
    if (eligibleMonths === creditMonths) break
    creditMonths = eligibleMonths
    salaries = earners.map((earner) =>
      takeHome(earner, taxSettings, creditMonths),
    )
    familyIncomeContext = householdContext(salaries)
    supportResult = familySupportResult(familySupport, familyIncomeContext)
  }
  const annualSupport = supportResult?.total ?? 0
  const taxCreditUnavailable = creditMonths === 0 && annualSupport > 0
  const annualTakeHome =
      annualTotal(income) +
      annualSupport +
      salaries.reduce((total, salary) => total + salary.net, 0),
    annualOther = annualTotal(other)
  const incomeValid =
    Boolean(supportResult) &&
    validTaxSettings(taxSettings) &&
    income.every((row) => isValidCalculatorAmount(row.amount)) &&
    earners.every((earner, index) =>
      isValidCalculatorAmount(earner.amount) &&
      Number.isFinite(salaries[index].gross) &&
      [earner.kiwiRate, earner.employerRate].every(
        (rate) => Number.isFinite(rate) && rate >= 0 && rate <= 100,
      ),
    )
  const annualIncome = incomeValid ? annualTakeHome : 0
  const baseChurch = annualTotal(church)
  const taxRefund = giveTaxRefund
    ? Math.round(((baseChurch + annualOther) / 3) * 100) / 100
    : 0
  const annualChurch = baseChurch + taxRefund
  const chartChurch =
    taxRefund > 0
      ? [
          ...church,
          {
            id: 'tax-refund',
            label: 'Tax refund',
            amount: String(taxRefund),
            frequency: 'yearly' as const,
          },
        ]
      : church
  const giving = annualChurch + annualOther
  const currentPercentage = givingPercentage(annualIncome, giving)
  return (
    <div className="ph-no-capture ph-mask" data-giving-private="true">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <div className="rounded-xl border border-warm-grey bg-white p-5 sm:p-7">
            <IncomeCalculator
              earners={earners}
              onChange={setEarners}
              settings={taxSettings}
              onSettingsChange={setTaxSettings}
              taxCreditUnavailable={taxCreditUnavailable}
              creditMonths={creditMonths}
            />
            <WorkingForFamilies
              value={familySupport}
              onChange={setFamilySupport}
              income={familyIncomeContext}
            />
            <AmountGroup
              kind="income"
              title="Other household income"
              totalLabel="Annual other income"
              rows={income}
              onChange={setIncome}
            />
            <dl className="mt-5 space-y-2 border-t border-warm-grey pt-4 text-sm font-semibold">
              <div className="flex justify-between gap-3">
                <dt>Annual household take-home</dt>
                <dd>
                  <output data-testid="household-take-home">
                    {incomeValid ? money.format(annualTakeHome) : '—'}
                  </output>
                </dd>
              </div>
            </dl>
          </div>
          <section
            className="space-y-8 rounded-xl border border-warm-grey bg-white p-5 sm:p-7"
            aria-labelledby="current-giving"
          >
            <div>
              <h2 id="current-giving" className="text-2xl font-bold">
                Your current giving
              </h2>
            </div>
            <AmountGroup
              kind="church"
              title="Ev giving"
              totalLabel="Annual Ev giving"
              rows={church}
              onChange={setChurch}
            />
            <AmountGroup
              kind="outside"
              title="Outside Ev giving"
              totalLabel="Annual outside Ev giving"
              rows={other}
              onChange={setOther}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={giveTaxRefund}
                  onChange={(event) => setGiveTaxRefund(event.target.checked)}
                  className="size-4 accent-rich-red"
                />
                Give my tax refund to Ev
              </label>
              <CalculatorInfo name="giving my tax refund to Ev">
                Adds one third of your current giving to Ev, assuming all gifts
                qualify for the NZ donation tax credit. Eligibility and taxable
                income limits apply.
              </CalculatorInfo>
              {giveTaxRefund && (
                <output
                  data-testid="tax-refund"
                  className="ml-auto font-semibold"
                >
                  {money.format(taxRefund)}
                </output>
              )}
            </div>
          </section>
        </div>
        <aside className="space-y-6 rounded-xl border border-warm-grey bg-white p-5 sm:p-7 lg:sticky lg:top-24">
          <GivingChart church={chartChurch} other={other} />
          <section
            aria-labelledby="giving-now"
            className="min-h-72 border-t border-warm-grey pt-6"
          >
            <h2 id="giving-now" className="font-bold">
              {earners.length > 1 ? 'Our giving right now' : 'My giving right now'}
            </h2>
            <p className="mt-3 text-4xl font-bold text-rich-red">
              <output data-testid="giving-percentage">
                {currentPercentage === null
                  ? money.format(giving)
                  : `${percentage.format(currentPercentage)}%`}
              </output>
            </p>
            <p className="mt-1 text-sm">
              {currentPercentage === null
                ? 'a year'
                : earners.length > 1
                  ? 'of our household take-home income'
                  : 'of my take-home income'}
            </p>
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
        annualIncome={annualIncome}
        annualChurch={annualChurch}
        annualOther={annualOther}
        funds={church.slice(0, 2).map((fund) => ({
          id: fund.id,
          label: fund.label,
          annual: annualTotal([fund]),
          frequency: fund.frequency,
        }))}
        annualFixedChurch={annualTotal(church.slice(2))}
        giveTaxRefund={giveTaxRefund}
      />
    </div>
  )
}
