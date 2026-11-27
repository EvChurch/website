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
  return rows
    .map((row, index) => ({
      id: row.id,
      label: row.label.trim() || 'Other gift',
      annual: annualTotal([row]),
      colour: colours[index % colours.length],
    }))
    .filter((row) => row.annual > 0)
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
    const label = point(start + share / 2, outer ? radius + 17 : radius)
    const description = `${row.label} · ${money.format(row.annual)}/yr · ${percent.format(share * 100)}%`
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
          textAnchor="middle"
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
      className="rounded-xl border border-warm-grey bg-white p-5 sm:p-7"
    >
      <h2 id="giving-chart-heading" className="text-xl font-bold">
        Where your giving goes
      </h2>
      <p className="mt-2 text-sm text-dark-grey">
        Reds are Ev giving · teals are outside giving
      </p>
      {total > 0 ? (
        <svg
          viewBox="0 0 360 360"
          className="mx-auto w-full max-w-sm"
          role="group"
          aria-label="Annual giving by gift and by Ev or outside giving"
        >
          <Ring
            rows={[...evGifts, ...outsideGifts]}
            total={total}
            radius={102}
            width={52}
          />
          <Ring
            rows={groups.filter((group) => group.annual > 0)}
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
        </svg>
      ) : (
        <div className="py-8 text-center">
          <svg
            viewBox="0 0 240 220"
            className="mx-auto w-full max-w-64"
            aria-hidden="true"
          >
            <circle
              cx="120"
              cy="110"
              r="80"
              fill="none"
              stroke="#D8D4CF"
              strokeWidth="30"
              strokeDasharray="2 7"
            />
          </svg>
          <p className="text-sm text-dark-grey">
            Your chart will appear here once you add some giving.
          </p>
        </div>
      )}
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
              {money.format(group.annual)}/yr
            </dd>
          </div>
        ))}
      </dl>
      {total > 0 && (
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
                          {gift.label}
                        </span>
                        <span className="shrink-0 text-right">
                          {money.format(gift.annual)}/yr ·{' '}
                          {percent.format((gift.annual / total) * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
        </div>
      )}
    </section>
  )
}
