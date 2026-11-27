import { useState } from 'react'
import { useGivingExperience } from '@/components/giving/GivingExperienceProvider'
import { GIVING_FREQUENCIES, type GivingFrequency } from '@/lib/generosity/calculator'

const levels = [3, 5, 7.5, 10, 12.5, 15, 20]
const money = (n: number) =>
  new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    maximumFractionDigits: 0,
  }).format(n)
const pct = (n: number) =>
  `${new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 1 }).format(n)}%`
interface Fund {
  id: string
  label: string
  annual: number
  frequency: GivingFrequency
}
export function GivingPlan({
  annualIncome,
  annualChurch,
  annualOther,
  funds,
  annualFixedChurch,
  giveTaxRefund,
}: {
  annualIncome: number
  annualChurch: number
  annualOther: number
  funds: Fund[]
  annualFixedChurch: number
  giveTaxRefund: boolean
}) {
  const { openGiving, givingSurfaceAvailable } = useGivingExperience()
  const [target, setTarget] = useState<number | null>(null)
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
  const selected = target !== null && target > currentPct ? target : next
  const annualDirectGiving = annualOther + annualFixedChurch
    + funds.reduce((total, fund) => total + fund.annual, 0)
  function giftIncrease(level: number, periods: number) {
    const annualIncrease = Math.max(
      0,
      ((annualIncome * level) / 100) / (giveTaxRefund ? 4 / 3 : 1) - annualDirectGiving,
    )
    return Math.ceil(annualIncrease / periods / 10) * 10
  }
  const currentGeneral = funds.find((fund) => fund.id === 'general')
  const setupFrequency = currentGeneral && currentGeneral.annual > 0
    ? currentGeneral.frequency
    : 'monthly'
  const { label: frequencyLabel, periods } = GIVING_FREQUENCIES[setupFrequency]
  const setupAmount = selected === undefined ? 0 : giftIncrease(selected, periods)
  const setupPeriod = {
    weekly: 'a week',
    fortnightly: 'a fortnight',
    monthly: 'a month',
    yearly: 'a year',
  }[setupFrequency]
  return (
    <section aria-labelledby="going-forward" className="mt-12">
      <h2 id="going-forward" className="mb-8 text-h2">
        Going forward
      </h2>
      <div className="rounded-xl border border-warm-grey bg-white p-5 sm:p-8">
        <h3 className="text-xl font-bold">
          What would a meaningful increase look like for your household?
        </h3>
        {annualIncome <= 0 ? (
          <p className="mt-4 text-dark-grey">
            Add your household income above and this table will fill in for your
            household.
          </p>
        ) : (
          <>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Giving levels based on household income
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-3">Giving</th>
                    <th scope="col" className="px-3 py-3">{frequencyLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {levels
                    .filter((level) => closest === null || level >= closest)
                    .map((level) => (
                      <tr
                        key={level}
                        onClick={closest !== level ? () => setTarget(level) : undefined}
                        className={`border-t border-warm-grey ${closest !== level ? 'cursor-pointer hover:bg-warm-white' : ''} ${selected === level ? 'bg-rich-red/5' : ''}`}
                      >
                        <th
                          scope="row"
                          className="min-w-24 px-3 py-3 font-semibold"
                        >
                          {closest === level ? pct(currentPct) : (
                            <button
                              type="button"
                              onClick={() => setTarget(level)}
                              aria-pressed={selected === level}
                              aria-label={`Select ${level}% giving`}
                              className="flex w-full items-center gap-3 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-rich-red"
                            >
                              <span
                                aria-hidden="true"
                                className={`size-4 rounded-full border ${selected === level ? 'border-[5px] border-rich-red' : 'border-mid-grey'}`}
                              />
                              ~{pct(level)}
                            </button>
                          )}
                        </th>
                        <td className="px-3 py-3">
                          {closest === level ? money(giving / periods) : (
                            <>
                              <span className="whitespace-nowrap">
                                +{money(giftIncrease(level, periods))}
                              </span>
                              {giveTaxRefund && (
                                <span className="mt-1 block text-xs text-dark-grey">
                                  (+{money(Math.ceil(giftIncrease(level, periods) * periods / 3))} annual tax refund)
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {selected !== undefined && (
              <>
                <button
                  type="button"
                  disabled={!givingSurfaceAvailable || setupAmount <= 0}
                  onClick={() => openGiving(undefined, {
                      amountMinor: Math.round(setupAmount * 100),
                      frequency: setupFrequency === 'yearly' ? 'annual' : setupFrequency,
                  })}
                  data-testid="setup-gift"
                  className="mt-6 block w-full rounded-lg bg-rich-red px-5 py-4 text-center font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Set up {currentGeneral && currentGeneral.annual > 0 ? 'an additional gift' : 'a gift'} of {money(setupAmount)} {setupPeriod}
                </button>
                {giveTaxRefund && setupAmount > 0 && (
                  <p className="mt-3 text-center text-sm text-dark-grey" data-testid="additional-refund">
                    Plus {money(Math.ceil(setupAmount * periods / 3))} a year through your tax refund.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
