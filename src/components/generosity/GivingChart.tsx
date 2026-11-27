import { annualTotal, type GivingFrequency } from '@/lib/generosity/calculator'

interface Gift {
  id: string
  label: string
  amount: string
  frequency: GivingFrequency
}

interface ChartGift {
  id: string
  label: string
  annual: number
  colour: string
}

const reds = ['#E22A30', '#8E181D', '#F0837B']
const teals = ['#083F3B', '#11605A', '#238078', '#3B9E93', '#5CBCAC']
const money = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  maximumFractionDigits: 0,
})
const percent = new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 1 })

function chartGifts(rows: Gift[], colours: string[]): ChartGift[] {
  return rows.map((row, index) => ({
    id: row.id,
    label: row.label.trim() || 'Other gift',
    annual: annualTotal([row]),
    colour: colours[index % colours.length],
  }))
}

function point(turn: number, radius: number) {
  const angle = (turn - 0.25) * Math.PI * 2
  return {
    x: 180 + Math.cos(angle) * radius,
    y: 180 + Math.sin(angle) * radius,
  }
}

function Ring({
  rows,
  total,
  radius,
  width,
  outer = false,
}: {
  rows: ChartGift[]
  total: number
  radius: number
  width: number
  outer?: boolean
}) {
  let offset = 0
  return rows.map((row) => {
    const share = row.annual / total
    const start = offset
    offset += share
    const label = point(start + share / 2, outer ? radius + 24 : radius)
    const description = `${row.label} · ${money.format(row.annual)} · ${percent.format(share * 100)}%`
    return (
      <g key={row.id}>
        <circle
          cx="180"
          cy="180"
          r={radius}
          fill="none"
          stroke={row.colour}
          strokeWidth={width}
          pathLength="100"
          strokeDasharray={`${share * 100} ${100 - share * 100}`}
          strokeDashoffset={-start * 100}
          transform="rotate(-90 180 180)"
          tabIndex={0}
          aria-label={description}
          className="focus-visible:outline-2 focus-visible:outline-rich-red"
        >
          <title>{description}</title>
        </circle>
        <text
          x={label.x}
          y={label.y}
          textAnchor={
            outer && Math.abs(label.x - 180) > 1
              ? label.x > 180
                ? 'start'
                : 'end'
              : 'middle'
          }
          dominantBaseline="central"
          fontSize={outer ? 12 : 11}
          fontWeight="700"
          fill={outer ? row.colour : '#FFFFFF'}
          aria-hidden="true"
          pointerEvents="none"
        >
          {percent.format(share * 100)}%
        </text>
      </g>
    )
  })
}

export function GivingChart({
  church,
  other,
}: {
  church: Gift[]
  other: Gift[]
}) {
  const evGifts = chartGifts(church, reds)
  const outsideGifts = chartGifts(other, teals)
  const annualChurch = annualTotal(church)
  const annualOther = annualTotal(other)
  const total = annualChurch + annualOther
  const groups = [
    {
      id: 'ev',
      label: 'Ev giving',
      tile: 'To Ev',
      annual: annualChurch,
      colour: reds[0],
      gifts: evGifts,
    },
    {
      id: 'outside',
      label: 'Outside Ev giving',
      tile: 'Outside Ev',
      annual: annualOther,
      colour: teals[0],
      gifts: outsideGifts,
    },
  ]

  return (
    <section
      aria-labelledby="giving-chart-heading"
      className="min-w-0"
    >
      <h2 id="giving-chart-heading" className="text-xl font-bold">
        Where your giving goes
      </h2>
      <svg
        viewBox="-28 -28 416 416"
        className="mx-auto aspect-square w-full max-w-sm"
        role="group"
        aria-label="Annual giving by gift and by Ev or outside giving"
      >
        {total > 0 ? (
          <>
            <Ring
              rows={[...outsideGifts, ...evGifts].filter(
                (gift) => gift.annual > 0,
              )}
              total={total}
              radius={102}
              width={52}
            />
            <Ring
              rows={[groups[1], groups[0]].filter((group) => group.annual > 0)}
              total={total}
              radius={140}
              width={7}
              outer
            />
            <text
              x="180"
              y="177"
              textAnchor="middle"
              fontSize={total >= 1000000 ? 16 : 22}
              fontWeight="700"
              fill="#0F0004"
            >
              {money.format(total)}
            </text>
            <text
              x="180"
              y="201"
              textAnchor="middle"
              fontSize="13"
              fill="#625E5B"
            >
              per year
            </text>
          </>
        ) : (
          <>
            <circle
              cx="180"
              cy="180"
              r="102"
              fill="none"
              stroke="#D8D4CF"
              strokeWidth="52"
            />
            <circle
              cx="180"
              cy="180"
              r="140"
              fill="none"
              stroke="#D8D4CF"
              strokeWidth="7"
            />
            <text
              x="180"
              y="177"
              textAnchor="middle"
              fontSize="22"
              fontWeight="700"
              fill="#625E5B"
            >
              $0
            </text>
            <text
              x="180"
              y="201"
              textAnchor="middle"
              fontSize="13"
              fill="#625E5B"
            >
              per year
            </text>
          </>
        )}
      </svg>
      <dl className="grid grid-cols-2 gap-3">
        {groups.map((group) => (
          <div key={group.id} className="rounded-lg bg-warm-white p-4">
            <dt
              className="text-sm font-semibold"
              style={{ color: group.colour }}
            >
              {group.tile}
            </dt>
            <dd className="mt-1 text-xl font-bold">
              {percent.format(total > 0 ? (group.annual / total) * 100 : 0)}%
            </dd>
            <dd className="mt-1 text-sm text-dark-grey">
              {money.format(group.annual)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 space-y-5">
        {groups.map(
          (group) =>
            group.gifts.length > 0 && (
              <div key={group.id}>
                <h3 className="text-sm font-bold">{group.label}</h3>
                <ul className="mt-2 space-y-2">
                  {group.gifts.map((gift) => (
                    <li
                      key={gift.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: gift.colour }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {gift.label}{' '}
                        <span className="text-mid-grey">
                          ({percent.format(
                            total > 0 ? (gift.annual / total) * 100 : 0,
                          )}%)
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {money.format(gift.annual)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ),
        )}
      </div>
      <dl className="mt-5 border-t border-warm-grey pt-4 text-sm font-bold">
        <div className="flex justify-between gap-3">
          <dt>Total</dt>
          <dd>
            <output data-testid="annual-giving">{money.format(total)}</output>
          </dd>
        </div>
      </dl>
    </section>
  )
}
