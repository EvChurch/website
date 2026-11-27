import { useId, useRef } from 'react'
import { HiTrash } from 'react-icons/hi2'
import { CalculatorFrequency } from './CalculatorFrequency'
import { CalculatorInfo } from './CalculatorInfo'
import { isValidCalculatorAmount } from '@/lib/generosity/calculator'
import {
  DEFAULT_TAX_SETTINGS,
  newEarner,
  takeHome,
  validTaxSettings,
  type Earner,
  type TaxSettings,
} from '@/lib/generosity/take-home'

const money = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  maximumFractionDigits: 0,
})
const fieldClass =
  'w-full min-w-0 rounded-lg border border-warm-grey bg-white px-3 py-3 text-base focus-visible:outline-2 focus-visible:outline-rich-red'

function NumberField({
  label,
  value,
  onChange,
  percent = false,
  max,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  percent?: boolean
  max?: number
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="mb-1 block">
        {label}
        {percent ? ' (%)' : ''}
      </span>
      <input
        type="number"
        min="0"
        max={percent ? 100 : max}
        step="any"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={fieldClass}
      />
    </label>
  )
}
function Toggle({
  children,
  checked,
  onChange,
  disabled = false,
}: {
  children: React.ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-rich-red"
      />
      {children}
    </label>
  )
}
export function IncomeCalculator({
  earners,
  onChange,
  settings,
  onSettingsChange,
  taxCreditUnavailable = false,
  creditMonths = 12,
}: {
  earners: Earner[]
  onChange: (earners: Earner[]) => void
  settings: TaxSettings
  taxCreditUnavailable?: boolean
  creditMonths?: number
  onSettingsChange: (settings: TaxSettings) => void
}) {
  const prefix = useId()
  const counter = useRef(0)
  const validSettings = validTaxSettings(settings)
  function update(id: string, patch: Partial<Earner>) {
    onChange(earners.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }
  function setting(key: Exclude<keyof TaxSettings, 'bands'>, value: number) {
    onSettingsChange({ ...settings, [key]: value })
  }
  return (
    <div className="mb-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Your household income</h2>
      </div>
      {earners.map((earner, index) => {
        const name = earner.name.trim() || `Earner ${index + 1}`
        const invalid =
          !isValidCalculatorAmount(earner.amount) ||
          !validSettings ||
          ![earner.kiwiRate, earner.employerRate].every(
            (rate) => Number.isFinite(rate) && rate >= 0 && rate <= 100,
          )
        const result = takeHome(
          { ...earner, taxCredit: earner.taxCredit && !taxCreditUnavailable },
          settings,
          creditMonths,
        )
        const breakdown = ([
          ['Gross pay', result.gross],
          ['PAYE', result.paye],
          ['ACC', result.acc],
          ['KiwiSaver', result.kiwiSaver],
          ['Student loan', result.studentLoan],
          ['Take-home pay', result.net],
          ['Tax credit included in PAYE', result.credit],
          ['Employer KiwiSaver (before ESCT)', result.employer],
        ] satisfies [string, number][]).filter(
          ([, value]) => !invalid && Math.abs(value) >= 0.5,
        )
        return (
          <section
            key={earner.id}
            aria-label={name}
            className="space-y-3 border-b border-warm-grey pb-5"
          >
            <div className="flex items-center gap-2">
              <input
                aria-label={`Name for earner ${index + 1}`}
                placeholder={`Earner ${index + 1}`}
                value={earner.name}
                onChange={(event) =>
                  update(earner.id, { name: event.target.value })
                }
                className="min-w-0 flex-1 border-b border-transparent bg-transparent text-sm font-semibold hover:border-warm-grey focus:border-rich-red focus:outline-none"
              />
              <CalculatorInfo name={`income for ${name}`}>
                Enter this person’s combined salary or wages before tax. Combine
                their jobs so personal tax thresholds apply once. Hourly pay
                assumes 52 paid weeks.
              </CalculatorInfo>
              {index > 0 && (
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() =>
                    onChange(earners.filter((e) => e.id !== earner.id))
                  }
                  className="flex size-11 items-center justify-center rounded-md text-mid-grey hover:text-rich-red"
                >
                  <HiTrash className="size-5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.7fr)] gap-2">
              <label className="relative">
                <span className="sr-only">Gross pay for {name}</span>
                <span
                  aria-hidden="true"
                  className="absolute top-3 left-3 text-dark-grey"
                >
                  $
                </span>
                <input
                  id={`${earner.id}-amount`}
                  aria-label={`Gross pay for ${name}`}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${earner.id}-error` : undefined}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={earner.amount}
                  onChange={(event) =>
                    update(earner.id, { amount: event.target.value })
                  }
                  className={`${fieldClass} pl-7`}
                />
              </label>
              <CalculatorFrequency
                id={`${earner.id}-frequency`}
                label={`Frequency for ${name}`}
                value={earner.frequency}
                hourly
                onChange={(frequency) => update(earner.id, { frequency })}
              />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              <Toggle
                checked={earner.kiwiSaver}
                onChange={(kiwiSaver) => update(earner.id, { kiwiSaver })}
              >
                KiwiSaver
              </Toggle>
              <Toggle
                checked={earner.studentLoan}
                onChange={(studentLoan) => update(earner.id, { studentLoan })}
              >
                Student loan
              </Toggle>
              <div className="flex items-center gap-1">
                <Toggle
                  checked={earner.taxCredit && !taxCreditUnavailable}
                  disabled={taxCreditUnavailable}
                  onChange={(taxCredit) => update(earner.id, { taxCredit })}
                >
                  Independent earner tax credit
                </Toggle>
                <CalculatorInfo name={`Independent earner tax credit for ${name}`}>
                  {taxCreditUnavailable ? (
                    <>
                      Independent earner tax credit is unavailable while
                      receiving Working for Families.
                    </>
                  ) : (
                    <>
                      {earner.taxCredit && (
                        <>Applied for {creditMonths} eligible months. </>
                      )}
                      Unavailable if you or your partner receive Working for
                      Families, or you receive an income-tested benefit, NZ Super
                      or an equivalent pension.{' '}
                      <a
                        href="https://www.ird.govt.nz/ietc"
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Check eligibility
                      </a>
                      .
                    </>
                  )}
                </CalculatorInfo>
              </div>
            </div>
            {earner.kiwiSaver && (
              <details className="text-sm">
                <summary className="cursor-pointer text-deep-red">
                  KiwiSaver settings · {earner.kiwiRate}%
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label="Your contribution"
                      percent
                      value={earner.kiwiRate}
                      onChange={(kiwiRate) => update(earner.id, { kiwiRate })}
                    />
                    <NumberField
                      label="Employer contribution"
                      percent
                      value={earner.employerRate}
                      onChange={(employerRate) =>
                        update(earner.id, { employerRate })
                      }
                    />
                  </div>
                  <Toggle
                    checked={earner.salarySacrifice}
                    onChange={(salarySacrifice) =>
                      update(earner.id, { salarySacrifice })
                    }
                  >
                    Salary sacrifice: employer contribution included in salary
                    package
                  </Toggle>
                  <p className="text-xs text-dark-grey">
                    Employer contributions are before ESCT and do not form part
                    of take-home pay.
                  </p>
                </div>
              </details>
            )}
            {invalid && (
              <p
                id={`${earner.id}-error`}
                role="alert"
                className="text-sm text-deep-red"
              >
                Check the income amount and settings. Use positive amounts and
                percentages from 0 to 100.
              </p>
            )}
            {breakdown.length === 0 && (
              <div className="flex justify-between gap-3 text-sm font-semibold">
                <span>Annual take-home</span>
                <output aria-label={`Annual take-home for ${name}`}>
                  {invalid ? '—' : money.format(result.net)}
                </output>
              </div>
            )}
            {breakdown.length > 0 && (
              <details className="group/breakdown text-sm">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden="true"
                    className="text-[10px] transition-transform group-open/breakdown:rotate-90"
                  >
                    ▶
                  </span>
                  <span>Annual take-home</span>
                  <output
                    className="ml-auto"
                    aria-label={`Annual take-home for ${name}`}
                  >
                    {money.format(result.net)}
                  </output>
                </summary>
                <dl className="mt-3 space-y-2">
                  {breakdown.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt>{label}</dt>
                      <dd>{money.format(value)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </section>
        )
      })}
      <button
        type="button"
        onClick={() =>
          onChange([...earners, newEarner(`${prefix}-${counter.current++}`)])
        }
        className="font-semibold text-deep-red underline underline-offset-4"
      >
        + Add another earner
      </button>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-deep-red">
          Tax settings · 2026/27
        </summary>
        <div className="mt-4 space-y-5">
          <p className="text-xs text-dark-grey">
            Annual salary and wage estimate, 1 April 2026–31 March 2027. Actual
            payroll deductions may vary. These settings apply to all earners.{' '}
            <a
              href="https://www.ird.govt.nz/income-tax/income-tax-for-individuals/tax-codes-and-tax-rates-for-individuals/tax-rates-for-individuals"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              IRD tax rates
            </a>
            .
          </p>
          <NumberField
            label="Standard hours per week"
            value={settings.hours}
            max={168}
            onChange={(value) => setting('hours', value)}
          />
          <fieldset className="space-y-3">
            <legend className="mb-2 font-semibold">PAYE bands</legend>
            {settings.bands.map((band, index) => (
              <div key={index} className="grid grid-cols-2 gap-3">
                <NumberField
                  label={`Band ${index + 1} up to ($)`}
                  value={band.threshold}
                  onChange={(value) =>
                    onSettingsChange({
                      ...settings,
                      bands: settings.bands.map((b, i) =>
                        i === index ? { ...b, threshold: value } : b,
                      ),
                    })
                  }
                />
                <NumberField
                  label={`Band ${index + 1} rate`}
                  percent
                  value={band.rate}
                  onChange={(value) =>
                    onSettingsChange({
                      ...settings,
                      bands: settings.bands.map((b, i) =>
                        i === index ? { ...b, rate: value } : b,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <NumberField
              label="Band 5 rate (above band 4)"
              percent
              value={settings.topRate}
              onChange={(value) => setting('topRate', value)}
            />
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">ACC</legend>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Levy"
                percent
                value={settings.accRate}
                onChange={(value) => setting('accRate', value)}
              />
              <NumberField
                label="Income cap ($)"
                value={settings.accCap}
                onChange={(value) => setting('accCap', value)}
              />
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">Student loan</legend>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Repayment rate"
                percent
                value={settings.studentRate}
                onChange={(value) => setting('studentRate', value)}
              />
              <NumberField
                label="Annual threshold ($)"
                value={settings.studentThreshold}
                onChange={(value) => setting('studentThreshold', value)}
              />
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">
              Independent earner tax credit
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['credit', 'Annual credit ($)'],
                  ['creditMin', 'Minimum income ($)'],
                  ['creditReduction', 'Reduction starts ($)'],
                  ['creditMax', 'Maximum income ($)'],
                ] as const
              ).map(([key, label]) => (
                <NumberField
                  key={key}
                  label={label}
                  value={settings[key]}
                  onChange={(value) => setting(key, value)}
                />
              ))}
            </div>
          </fieldset>
          {!validSettings && (
            <p role="alert" className="text-deep-red">
              Check your settings. Tax bands must increase, and the credit
              maximum must exceed its reduction point.
            </p>
          )}
          <button
            type="button"
            onClick={() => onSettingsChange(DEFAULT_TAX_SETTINGS)}
            className="text-deep-red underline underline-offset-4"
          >
            Restore IRD defaults
          </button>
        </div>
      </details>
    </div>
  )
}
