import { FormSelect } from '@/components/forms/FormSelect'
import { useEffect, useRef, useState } from 'react'
import {
  annualTotal,
  GIVING_FREQUENCIES,
  isValidCalculatorAmount,
  type GivingFrequency,
} from '@/lib/generosity/calculator'

const levels = [3, 5, 7.5, 10, 12.5, 15, 20]
const money = (n: number) =>
  new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    maximumFractionDigits: 0,
  }).format(n)
const pct = (n: number) =>
  `${new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 1 }).format(n)}%`
const inputClass =
  'w-full rounded-md border border-warm-grey bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-rich-red'
interface PlanAmount {
  amount: string
  frequency: GivingFrequency
}
interface Plan {
  target: number
  church: PlanAmount
  other: PlanAmount
}
function PlanInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: PlanAmount
  onChange: (value: PlanAmount) => void
}) {
  const invalid = !isValidCalculatorAmount(value.amount)
  return (
    <div className="min-w-40 space-y-2">
      <label className="relative block">
        <span className="sr-only">{label} amount</span>
        <span aria-hidden="true" className="absolute top-2 left-3">
          $
        </span>
        <input
          aria-invalid={invalid}
          aria-describedby={
            invalid
              ? `plan-${label === 'Local church' ? 'church' : 'other'}-error`
              : undefined
          }
          className={`${inputClass} pl-7`}
          type="text"
          inputMode="decimal"
          value={value.amount}
          onChange={(e) => onChange({ ...value, amount: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="sr-only">{label} frequency</span>
        <FormSelect
          className="text-base"
          value={value.frequency}
          onChange={(e) => {
            const frequency = e.target.value as GivingFrequency
            onChange({
              frequency,
              amount:
                value.amount.trim() && isValidCalculatorAmount(value.amount)
                  ? (
                      annualTotal([value]) /
                      GIVING_FREQUENCIES[frequency].periods
                    ).toFixed(2)
                  : value.amount,
            })
          }}
        >
          {Object.entries(GIVING_FREQUENCIES).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </FormSelect>
      </label>
      {invalid && (
        <p
          id={`plan-${label === 'Local church' ? 'church' : 'other'}-error`}
          className="text-sm text-deep-red"
        >
          Enter a positive amount with up to two decimal places.
        </p>
      )}
    </div>
  )
}
export function GivingPlan({
  annualIncome,
  annualChurch,
  annualOther,
  churchFrequency,
  outsideFrequency,
}: {
  annualIncome: number
  annualChurch: number
  annualOther: number
  churchFrequency: GivingFrequency
  outsideFrequency: GivingFrequency
}) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const planRef = useRef<HTMLElement>(null)
  const giving = annualChurch + annualOther,
    currentPct = annualIncome > 0 ? (giving / annualIncome) * 100 : 0
  const closest =
    currentPct > 0
      ? levels.reduce((best, value) =>
          Math.abs(value - currentPct) < Math.abs(best - currentPct)
            ? value
            : best,
        )
      : null
  const next =
    closest === null ? levels[0] : levels[levels.indexOf(closest) + 1]
  useEffect(() => {
    if (plan)
      planRef.current?.scrollIntoView?.({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
          .matches
          ? 'instant'
          : 'smooth',
        block: 'start',
      })
  }, [plan?.target])
  function explore(target: number) {
    setPlan({
      target,
      church: {
        amount: (
          Math.max(0, (annualIncome * target) / 100 - annualOther) /
          GIVING_FREQUENCIES[churchFrequency].periods
        ).toFixed(2),
        frequency: churchFrequency,
      },
      other: {
        amount: (
          annualOther / GIVING_FREQUENCIES[outsideFrequency].periods
        ).toFixed(2),
        frequency: outsideFrequency,
      },
    })
  }
  const newChurch = plan ? annualTotal([plan.church]) : 0,
    newOther = plan ? annualTotal([plan.other]) : 0,
    newTotal = newChurch + newOther
  function change(now: number, future: number, percentage = false) {
    const difference = future - now
    return Math.abs(difference) < (percentage ? 0.05 : 0.5)
      ? 'No change'
      : `${difference > 0 ? '+' : '−'}${percentage ? `${Math.abs(difference).toFixed(1)} pts` : `${money(Math.abs(difference))}/yr · ${money(Math.abs(difference) / 52)}/wk`}`
  }
  return (
    <section aria-labelledby="going-forward" className="mt-12">
      <h2 id="going-forward" className="mb-8 text-center text-h2">
        Going forward
      </h2>
      <div className="rounded-xl border border-warm-grey bg-white p-5 sm:p-8">
        <h3 className="text-xl font-bold">
          What would each percentage look like for your household?
        </h3>
        {annualIncome <= 0 ? (
          <p className="mt-4 text-dark-grey">
            Add your household income above and this table will fill in for your
            household.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-dark-grey">
              Based on your household income of {money(annualIncome)} a year
              before tax.
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Giving levels based on household income
                </caption>
                <thead>
                  <tr>
                    {[
                      'Giving',
                      'Weekly',
                      'Fortnightly',
                      'Monthly',
                      'Yearly',
                    ].map((h) => (
                      <th key={h} scope="col" className="px-3 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {levels.map((level) => (
                    <tr
                      key={level}
                      className={`group border-t border-warm-grey ${closest === level ? 'bg-rich-red/5' : ''}`}
                    >
                      <th
                        scope="row"
                        className="min-w-48 px-3 py-3 font-semibold"
                      >
                        {level}%{' '}
                        {closest === level ? (
                          <span className="ml-2 inline-block rounded-full bg-rich-red px-2 py-1 text-xs text-white">
                            You’re about here
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => explore(level)}
                            className={`ml-2 rounded border border-rich-red px-2 py-1 text-xs text-deep-red ${level !== next ? 'lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 [@media(hover:none)]:opacity-100' : ''}`}
                            aria-label={`Explore ${level}% giving`}
                          >
                            Explore this level
                          </button>
                        )}
                      </th>
                      {[52, 26, 12, 1].map((periods) => (
                        <td
                          key={periods}
                          className="px-3 py-3 whitespace-nowrap"
                        >
                          {money((annualIncome * level) / 100 / periods)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {giving > 0 && next !== undefined && (
              <button
                type="button"
                onClick={() => explore(next)}
                className="mt-6 w-full rounded-lg bg-rich-red px-5 py-4 font-semibold text-white"
              >
                What would it look like to up my giving to the next stage (
                {next}%) and put that into my local church?
              </button>
            )}
          </>
        )}
      </div>
      {plan && (
        <section
          ref={planRef}
          aria-labelledby="new-giving"
          className="mt-8 scroll-mt-24 rounded-xl border border-rich-red bg-white p-5 sm:p-8"
        >
          <h3 id="new-giving" className="text-h3">
            My new giving
          </h3>
          <p className="mt-3 text-sm text-dark-grey">
            Stepping up to around {plan.target}% of your household income, with
            the increase going to your local church. Edit the amounts to make
            this plan yours.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Compare your current giving with your new giving plan
              </caption>
              <thead>
                <tr>
                  {['', 'Now', 'My new giving', 'Change'].map((h, i) => (
                    <th key={i} scope="col" className="px-3 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-warm-grey">
                  <th scope="row" className="px-3 py-4">
                    Local church (Ev)
                  </th>
                  <td className="px-3">{money(annualChurch)}/yr</td>
                  <td className="px-3 py-4">
                    <PlanInput
                      label="Local church"
                      value={plan.church}
                      onChange={(church) => setPlan({ ...plan, church })}
                    />
                    <p className="mt-2">
                      {money(newChurch)}/yr · {money(newChurch / 52)}/wk
                    </p>
                  </td>
                  <td className="px-3">{change(annualChurch, newChurch)}</td>
                </tr>
                <tr className="border-t border-warm-grey">
                  <th scope="row" className="px-3 py-4">
                    Outside Ev
                  </th>
                  <td className="px-3">{money(annualOther)}/yr</td>
                  <td className="px-3 py-4">
                    <PlanInput
                      label="Outside Ev"
                      value={plan.other}
                      onChange={(other) => setPlan({ ...plan, other })}
                    />
                    <p className="mt-2">
                      {money(newOther)}/yr · {money(newOther / 52)}/wk
                    </p>
                  </td>
                  <td className="px-3">{change(annualOther, newOther)}</td>
                </tr>
                <tr className="border-t border-warm-grey font-bold">
                  <th scope="row" className="px-3 py-4">
                    Total giving
                  </th>
                  <td className="px-3">{money(giving)}/yr</td>
                  <td className="px-3" data-testid="planned-total">
                    {money(newTotal)}/yr
                  </td>
                  <td className="px-3">{change(giving, newTotal)}</td>
                </tr>
                <tr className="border-t border-warm-grey">
                  <th scope="row" className="px-3 py-4">
                    % of income
                  </th>
                  <td className="px-3">
                    {annualIncome > 0 ? pct(currentPct) : '—'}
                  </td>
                  <td className="px-3">
                    {annualIncome > 0
                      ? pct((newTotal / annualIncome) * 100)
                      : '—'}
                  </td>
                  <td className="px-3">
                    {annualIncome > 0
                      ? change(
                          currentPct,
                          (newTotal / annualIncome) * 100,
                          true,
                        )
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {annualIncome > 0 && newTotal > annualIncome && (
            <p className="mt-4 text-sm text-deep-red">
              Your plan exceeds the income entered. Check your amounts and
              frequencies.
            </p>
          )}
          {newChurch > 0 && (
            <p className="mt-5 text-sm text-dark-grey">
              Your planned Ev giving could qualify for a donation tax credit of
              about {money(newChurch / 3)}, bringing its annual cost to{' '}
              {money((newChurch * 2) / 3)}. Eligibility and taxable income
              limits apply.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-4">
            <a
              href="https://give.ev.church"
              className="rounded-md bg-rich-red px-5 py-3 font-semibold text-white"
            >
              Set up my giving
            </a>
            <button
              type="button"
              onClick={() => setPlan(null)}
              className="px-3 py-3 font-semibold text-deep-red underline"
            >
              Clear this plan
            </button>
          </div>
        </section>
      )}
    </section>
  )
}
