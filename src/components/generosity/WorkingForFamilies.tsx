import { useId, useRef } from 'react'
import { HiTrash } from 'react-icons/hi2'
import { CalculatorInfo } from './CalculatorInfo'
import {
  FAMILY_TAX_YEAR,
  familySupportResult,
  newFamilyChild,
  type FamilyChild,
  type FamilyCircumstances,
  type FamilyIncomeContext,
  type FamilySupport,
} from '@/lib/generosity/working-for-families'

const money = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const fieldClass =
  'w-full min-w-0 rounded-lg border border-warm-grey bg-white px-3 py-3 text-base focus-visible:outline-2 focus-visible:outline-rich-red'
function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date' | 'number'
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="mb-1 block">{label}</span>
      <input
        type={type}
        inputMode={type === 'text' ? 'decimal' : undefined}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  )
}
function Check({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-rich-red"
      />
      {label}
    </label>
  )
}
function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-md text-mid-grey hover:text-rich-red focus-visible:outline-2 focus-visible:outline-rich-red"
    >
      <HiTrash className="size-5" aria-hidden="true" />
    </button>
  )
}
function PeriodFields({
  value,
  onChange,
  income,
  prefix = '',
  showIncome = false,
}: {
  value: FamilyCircumstances
  onChange: (value: FamilyCircumstances) => void
  income: FamilyIncomeContext
  prefix?: string
  showIncome?: boolean
}) {
  function update(patch: Partial<FamilyCircumstances>) {
    onChange({ ...value, ...patch })
  }
  return (
    <div className="space-y-3">
      {showIncome && (
        <>
          <Field
            label={`${prefix}Annual family income before tax ($)`}
            value={value.familyIncome ?? String(income.gross)}
            onChange={(familyIncome) => update({ familyIncome })}
          />
          <p className="text-xs text-dark-grey">
            Starts with gross pay above. Includes both parents and IRD income
            adjustments; excludes Working for Families. For a part-year
            relationship, enter the annualised income for that relationship
            period.{' '}
            {value.familyIncome !== null && (
              <button
                type="button"
                onClick={() => update({ familyIncome: null, netIncome: null })}
                className="text-deep-red underline"
              >
                Use pay above
              </button>
            )}
          </p>
        </>
      )}
      <Check
        label={`${prefix}Income from paid work`}
        checked={value.inWork ?? (income.salaryGross ?? income.gross) > 0}
        onChange={(inWork) => update({ inWork })}
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-deep-red">
          Work, benefits and income details
        </summary>
        <div className="mt-3 space-y-3">
          <Check
            label={`${prefix}Eligible during this period`}
            checked={value.eligible}
            onChange={(eligible) => update({ eligible })}
          />
          <Check
            label={`${prefix}Two-parent family`}
            checked={value.couple ?? income.couple ?? false}
            onChange={(couple) => update({ couple })}
          />
          <Check
            label={`${prefix}Either parent receives a main benefit`}
            checked={value.mainBenefit}
            onChange={(mainBenefit) => update({ mainBenefit })}
          />
          {value.mainBenefit && (
            <>
              <Field
                label={`${prefix}Family income per benefit month ($)`}
                value={value.benefitIncome}
                onChange={(benefitIncome) => update({ benefitIncome })}
              />
              <p className="text-xs text-dark-grey">
                Include all family income for each benefit month. This applies
                the protected family and Best Start credits; add a dated change
                if the monthly income changes.
              </p>
            </>
          )}
          <Check
            label={`${prefix}Either parent receives a student allowance`}
            checked={value.studentAllowance}
            onChange={(studentAllowance) => update({ studentAllowance })}
          />
          {(value.inWork ?? (income.salaryGross ?? income.gross) > 0) && (
            <>
              <Field
                label={`${prefix}Combined qualifying salary/wage hours per week`}
                type="number"
                value={value.hours || String(income.hours)}
                onChange={(hours) => update({ hours })}
              />
              {showIncome && (
                <Field
                  label={`${prefix}Annual net family scheme income ($)`}
                  value={
                    value.netIncome ??
                    (value.familyIncome === null
                      ? String(income.afterIncomeTax)
                      : '')
                  }
                  onChange={(netIncome) => update({ netIncome })}
                />
              )}
              <p className="text-xs text-dark-grey">
                For the minimum family tax credit: income after income tax,
                before ACC, KiwiSaver and student loans, including net IRD
                adjustments. For part-year work, use annualised income from the
                qualifying work weeks. Qualifying salary/wage work requires 20
                hours a week for a sole parent or 30 combined for a couple.
              </p>
              <a
                href="https://www.ird.govt.nz/working-for-families/types/minimum-family-tax-credit"
                target="_blank"
                rel="noreferrer"
                className="text-xs underline"
              >
                Check qualifying work rules
              </a>
            </>
          )}
        </div>
      </details>
    </div>
  )
}
function ChildFields({
  value,
  onChange,
  index,
}: {
  value: FamilyChild
  onChange: (value: FamilyChild) => void
  index: number
}) {
  function update(patch: Partial<FamilyChild>) {
    onChange({ ...value, ...patch })
  }
  const name = `Child ${index + 1}`
  return (
    <div className="space-y-3 border-t border-warm-grey pt-4">
      <Field
        label={`${name} date of birth`}
        type="date"
        value={value.birthDate}
        onChange={(birthDate) => update({ birthDate })}
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-deep-red">
          Care and parental leave
        </summary>
        <div className="mt-3 space-y-4">
          <Check
            label={`${name} remains financially dependent and in education after turning 18`}
            checked={value.educationAfter18}
            onChange={(educationAfter18) => update({ educationAfter18 })}
          />
          <p className="text-xs text-dark-grey">
            Care dates must cover only days the child meets the dependent-child
            rules. Education eligibility ends by 31 December of the year they
            turn 18. Shared care must meet IRD’s one-third care requirement over
            four months or the tax year.
          </p>
          {value.care.map((care, careIndex) => (
            <div
              key={careIndex}
              className="space-y-3 rounded-md border border-warm-grey p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  Care period {careIndex + 1}
                </span>
                {value.care.length > 1 && (
                  <Remove
                    label={`Remove ${name} care period ${careIndex + 1}`}
                    onClick={() =>
                      update({
                        care: value.care.filter((_, i) => i !== careIndex),
                      })
                    }
                  />
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label={`${name} care ${careIndex + 1} from`}
                  type="date"
                  value={care.from}
                  onChange={(from) =>
                    update({
                      care: value.care.map((item, i) =>
                        i === careIndex ? { ...item, from } : item,
                      ),
                    })
                  }
                />
                <Field
                  label={`${name} care ${careIndex + 1} to`}
                  type="date"
                  value={care.to}
                  onChange={(to) =>
                    update({
                      care: value.care.map((item, i) =>
                        i === careIndex ? { ...item, to } : item,
                      ),
                    })
                  }
                />
              </div>
              <Field
                label={`${name} days in your care each fortnight (${careIndex + 1})`}
                type="number"
                value={care.days}
                onChange={(days) =>
                  update({
                    care: value.care.map((item, i) =>
                      i === careIndex ? { ...item, days } : item,
                    ),
                  })
                }
              />
              <Check
                label={`${name} receives foster, orphan or unsupported-child payments (${careIndex + 1})`}
                checked={care.excluded}
                onChange={(excluded) =>
                  update({
                    care: value.care.map((item, i) =>
                      i === careIndex ? { ...item, excluded } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update({
                care: [
                  ...value.care,
                  { from: '', to: '', days: '14', excluded: false },
                ],
              })
            }
            className="text-deep-red underline"
          >
            + Add a care period
          </button>
          {value.parentalLeave.map((leave, leaveIndex) => (
            <div
              key={leaveIndex}
              className="space-y-3 rounded-md border border-warm-grey p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  Paid parental leave {leaveIndex + 1}
                </span>
                <Remove
                  label={`Remove ${name} paid parental leave ${leaveIndex + 1}`}
                  onClick={() =>
                    update({
                      parentalLeave: value.parentalLeave.filter(
                        (_, i) => i !== leaveIndex,
                      ),
                    })
                  }
                />
              </div>
              <Field
                label={`${name} paid parental leave ${leaveIndex + 1} from`}
                type="date"
                value={leave.from}
                onChange={(from) =>
                  update({
                    parentalLeave: value.parentalLeave.map((item, i) =>
                      i === leaveIndex ? { ...item, from } : item,
                    ),
                  })
                }
              />
              <Field
                label={`${name} paid parental leave ${leaveIndex + 1} to`}
                type="date"
                value={leave.to}
                onChange={(to) =>
                  update({
                    parentalLeave: value.parentalLeave.map((item, i) =>
                      i === leaveIndex ? { ...item, to } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update({
                parentalLeave: [...value.parentalLeave, { from: '', to: '' }],
              })
            }
            className="block text-deep-red underline"
          >
            + Add paid parental leave
          </button>
          <p className="text-xs text-dark-grey">
            Best Start excludes the paid parental leave dates entered for this
            child. All date ranges include their first and last day.
          </p>
        </div>
      </details>
    </div>
  )
}
export function WorkingForFamilies({
  value,
  onChange,
  income,
}: {
  value: FamilySupport
  onChange: (value: FamilySupport) => void
  income: FamilyIncomeContext
}) {
  const prefix = useId()
  const counter = useRef(0)
  function update(patch: Partial<FamilySupport>) {
    onChange({ ...value, ...patch })
  }
  const result = familySupportResult(value, income)
  return (
    <section aria-label="Working for Families" className="mb-7 space-y-3">
      <div className="flex items-center gap-2">
        <Check
          label="Working for Families"
          checked={value.estimate}
          onChange={(estimate) => update({ estimate, eligible: estimate })}
        />
        <CalculatorInfo name="Working for Families">
          Uses your income above and the 2026/27 IRD rules. By ticking this, you
          confirm your family meets the eligibility rules. The default is
          full-year care of dependent children aged 3–17. Add birth dates for
          Best Start, children turning 18, or changes in care.{' '}
          <a
            href="https://www.ird.govt.nz/working-for-families/can-you-get-it"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            IRD eligibility
          </a>
          .
        </CalculatorInfo>
      </div>
      {value.estimate && (
        <div className="space-y-4">
          <Field
            label="Dependent children"
            type="number"
            value={value.children}
            onChange={(children) => {
              const count = Number(children)
              update({
                children,
                childDetails:
                  /^\d+$/.test(children) &&
                  Number.isSafeInteger(count) &&
                  count >= 0 &&
                  count <= 30
                    ? Array.from(
                        { length: count },
                        (_, i) =>
                          value.childDetails[i] ??
                          newFamilyChild(`${prefix}-${counter.current++}`),
                      )
                    : [],
              })
            }}
          />
          <details className="text-sm">
            <summary className="cursor-pointer text-deep-red">
              Child dates, shared care and other details
            </summary>
            <div className="mt-4 space-y-4">
              <p className="text-xs text-dark-grey">
                Add every child’s birth date if any child is under 3, turning
                18, or has a change in care. Income and work defaults come from
                above; adjust work or benefit details only if needed.
              </p>
              {value.childDetails.map((child, index) => (
                <ChildFields
                  key={child.id}
                  index={index}
                  value={child}
                  onChange={(next) =>
                    update({
                      childDetails: value.childDetails.map((item) =>
                        item.id === child.id ? next : item,
                      ),
                    })
                  }
                />
              ))}
              <PeriodFields
                value={value.periods[0]}
                onChange={(period) =>
                  update({
                    periods: value.periods.map((item, i) =>
                      i === 0 ? period : item,
                    ),
                  })
                }
                income={income}
              />
              <details className="text-sm">
                <summary className="cursor-pointer text-deep-red">
                  Changes during the tax year
                </summary>
                <div className="mt-3 space-y-4">
                  <p className="text-xs text-dark-grey">
                    Each dated change applies until the next one. A pay rise
                    alone changes your annual income above; a change in
                    relationship can change the annualised family income for
                    that period.
                  </p>
                  {value.periods.slice(1).map((period, index) => (
                    <div
                      key={index}
                      className="space-y-3 border-t border-warm-grey pt-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Change {index + 1}</h4>
                        <Remove
                          label={`Remove family change ${index + 1}`}
                          onClick={() =>
                            update({
                              periods: value.periods.filter(
                                (_, i) => i !== index + 1,
                              ),
                            })
                          }
                        />
                      </div>
                      <Field
                        label={`Change ${index + 1} applies from`}
                        type="date"
                        value={period.from}
                        onChange={(from) =>
                          update({
                            periods: value.periods.map((item, i) =>
                              i === index + 1 ? { ...item, from } : item,
                            ),
                          })
                        }
                      />
                      <PeriodFields
                        prefix={`Change ${index + 1}: `}
                        showIncome
                        value={period}
                        onChange={(next) =>
                          update({
                            periods: value.periods.map((item, i) =>
                              i === index + 1 ? next : item,
                            ),
                          })
                        }
                        income={income}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        periods: [
                          ...value.periods,
                          {
                            ...value.periods[value.periods.length - 1],
                            from: '',
                          },
                        ],
                      })
                    }
                    className="text-deep-red underline"
                  >
                    + Add a family change
                  </button>
                </div>
              </details>
            </div>
          </details>
          {result && (
            <details className="group/breakdown text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden="true"
                  className="text-[10px] transition-transform group-open/breakdown:rotate-90"
                >
                  ▶
                </span>
                <span>Annual support</span>
                <output
                  className="ml-auto"
                  data-testid="working-for-families-total"
                >
                  {money.format(result.total)}
                </output>
              </summary>
              <dl className="mt-2 space-y-2">
                {(
                  [
                    ['Family tax credit', result.family],
                    ['In-work tax credit', result.inWork],
                    ['Best Start', result.bestStart],
                    ['Minimum family tax credit', result.minimum],
                  ] as const
                ).map(([label, amount]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt>{label}</dt>
                    <dd>{money.format(amount)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {!result && (
            <p
              id="working-for-families-error"
              role="alert"
              className="text-sm text-deep-red"
            >
              {!/^\d+$/.test(value.children)
                ? 'Enter the number of dependent children.'
                : 'Check child dates, care periods and any changes entered in the details.'}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
