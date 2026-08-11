import type { ReactNode } from 'react'

import type {
  AttendanceMark,
  AttendanceSeries,
  GroupAttendanceOverview,
} from '@/lib/members/attendance'
import type { MemberRosterPerson } from '@/lib/members/data'

import { MemberAvatar } from './MemberAvatar'

function phoneHref(number: string) {
  return `tel:${number.replace(/[^+\d]/gu, '')}`
}

function smsHref(number: string) {
  return `sms:${number.replace(/[^+\d]/gu, '')}`
}

function MailIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75 12 13l9-6.25M4.5 19.5h15A1.5 1.5 0 0 0 21 18V6a1.5 1.5 0 0 0-1.5-1.5h-15A1.5 1.5 0 0 0 3 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106a1.125 1.125 0 0 0-1.173.417l-.97 1.293a1.125 1.125 0 0 1-1.21.38 12.035 12.035 0 0 1-7.143-7.143 1.125 1.125 0 0 1 .38-1.21l1.293-.97c.37-.277.527-.756.417-1.173L6.963 3.102A1.125 1.125 0 0 0 5.872 2.25H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 0 1-4.555-1.11L3 20.25l1.327-3.317A7.777 7.777 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  )
}

function ContactAction({
  href,
  label,
  title,
  children,
}: {
  href: string | null
  label: string
  title: string
  children: ReactNode
}) {
  const className = 'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors'
  if (!href) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${label} unavailable`}
        title={title}
        className={`${className} cursor-not-allowed bg-[#f2efeb] text-mid-grey/35`}
      >
        {children}
      </button>
    )
  }
  return (
    <a
      href={href}
      aria-label={label}
      title={title}
      className={`${className} bg-warm-white text-brand-black hover:bg-rich-red hover:text-white`}
    >
      {children}
    </a>
  )
}

function formattedDate(date: string) {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`))
}

function AttendanceMarkView({ mark }: { mark: AttendanceMark | null }) {
  if (!mark) {
    return <span aria-hidden="true" className="h-5 w-5 rounded-md bg-[#f2efeb]" />
  }
  const label = `${mark.didAttend ? 'Attended' : 'Missed'} ${formattedDate(mark.date)}`
  return (
    <span
      aria-label={label}
      title={label}
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[0.625rem] font-bold ${
        mark.didAttend
          ? 'bg-[#e2eee1] text-[#35633c]'
          : 'bg-light-red text-rich-red'
      }`}
    >
      {mark.didAttend ? '✓' : '×'}
    </span>
  )
}

function AttendanceRow({ label, series }: { label: string; series: AttendanceSeries }) {
  const marks: Array<AttendanceMark | null> = [
    ...Array<null>(Math.max(0, 4 - series.recent.length)).fill(null),
    ...series.recent,
  ]
  return (
    <div className="grid grid-cols-[3.25rem_1fr_2.5rem] items-center gap-2">
      <span className="text-[0.6875rem] font-bold text-mid-grey">{label}</span>
      <div className="flex gap-1">{marks.map((mark, index) => <AttendanceMarkView key={mark?.date ?? `empty-${index}`} mark={mark} />)}</div>
      <span className="text-right text-xs font-bold text-brand-black">
        {series.ytdPercentage === null ? '—' : `${series.ytdPercentage}%`}
        <span className="block text-[0.5rem] uppercase tracking-wide text-mid-grey">YTD</span>
      </span>
    </div>
  )
}

function PersonAttendance({ summary }: { summary: GroupAttendanceOverview['people'][number] }) {
  return (
    <div className="space-y-1.5 rounded-lg bg-[#fbf8f4] p-2.5 xl:bg-transparent xl:p-0">
      <AttendanceRow label="CG" series={summary.connectGroup} />
      <AttendanceRow label="Church" series={summary.church} />
    </div>
  )
}

function PersonRow({
  person,
  attendance,
}: {
  person: MemberRosterPerson
  attendance: GroupAttendanceOverview['people'][number] | null
}) {
  const phone = person.phones[0]?.number ?? null
  return (
    <article className="grid gap-3 border-t border-warm-grey px-4 py-4 first:border-t-0 sm:px-5 xl:grid-cols-[minmax(0,1fr)_18rem_auto] xl:items-center xl:gap-5">
      <div className="flex min-w-0 items-center gap-3">
        <MemberAvatar name={person.name} src={person.avatarUrl} size="small" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-bold leading-tight text-brand-black">{person.name}</h3>
            {person.isLeader && <span className="rounded-full bg-light-red px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-rich-red">Leader</span>}
          </div>
          {attendance?.attentionLabel && (
            <span className="mt-1 inline-block text-xs font-bold text-rich-red">{attendance.attentionLabel}</span>
          )}
        </div>
      </div>
      {attendance && <PersonAttendance summary={attendance} />}
      <div className="flex shrink-0 gap-1.5 xl:justify-end">
        <ContactAction href={person.email ? `mailto:${person.email}` : null} label={`Email ${person.name}`} title={person.email ?? 'No email address'}>
          <MailIcon />
        </ContactAction>
        <ContactAction href={phone ? phoneHref(phone) : null} label={`Call ${person.name}`} title={phone ?? 'No phone number'}>
          <PhoneIcon />
        </ContactAction>
        <ContactAction href={phone ? smsHref(phone) : null} label={`Text ${person.name}`} title={phone ? `Text ${phone}` : 'No phone number'}>
          <MessageIcon />
        </ContactAction>
      </div>
    </article>
  )
}

function RosterSection({
  title,
  people,
  attendance,
}: {
  title: string
  people: MemberRosterPerson[]
  attendance: GroupAttendanceOverview | null
}) {
  if (people.length === 0) return null
  return (
    <section className="mt-7">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-2xl text-brand-black">{title}</h2>
        <span className="text-xs text-mid-grey">{people.length}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-warm-grey bg-white">
        {people.map((person) => (
          <PersonRow key={person.rockPersonId} person={person} attendance={attendance?.people[person.rockPersonId] ?? null} />
        ))}
      </div>
    </section>
  )
}

function sortNeedsAttention(
  people: MemberRosterPerson[],
  attendance: GroupAttendanceOverview,
) {
  return [...people].sort((left, right) => {
    const leftSummary = attendance.people[left.rockPersonId]
    const rightSummary = attendance.people[right.rockPersonId]
    const leftMisses = Math.max(leftSummary?.connectGroup.missedInARow ?? 0, leftSummary?.church.missedInARow ?? 0)
    const rightMisses = Math.max(rightSummary?.connectGroup.missedInARow ?? 0, rightSummary?.church.missedInARow ?? 0)
    return rightMisses - leftMisses || left.name.localeCompare(right.name)
  })
}

export function ConnectGroupRoster({
  people,
  attendance,
}: {
  people: MemberRosterPerson[]
  attendance: GroupAttendanceOverview | null
}) {
  if (!attendance) return <RosterSection title="People" people={people} attendance={null} />
  const needsAttention = sortNeedsAttention(
    people.filter((person) => attendance.people[person.rockPersonId]?.needsAttention),
    attendance,
  )
  const everyoneElse = people.filter((person) => !attendance.people[person.rockPersonId]?.needsAttention)
  return (
    <>
      <RosterSection title="Needs attention" people={needsAttention} attendance={attendance} />
      <RosterSection title="People" people={everyoneElse} attendance={attendance} />
    </>
  )
}

function AttendanceSummaryRow({
  label,
  recent,
  ytd,
}: {
  label: string
  recent: number | null
  ytd: number | null
}) {
  return (
    <div className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center gap-3 border-t border-warm-grey py-2 first:border-t-0">
      <span className="text-xs font-bold text-brand-black">{label}</span>
      <span className="text-right text-sm font-bold text-brand-black">{recent === null ? '—' : `${recent}%`}</span>
      <span className="text-right text-sm font-bold text-brand-black">{ytd === null ? '—' : `${ytd}%`}</span>
    </div>
  )
}

export function ConnectGroupAttendanceSummary({ attendance }: { attendance: GroupAttendanceOverview }) {
  return (
    <aside
      aria-label="Group attendance summary"
      data-attendance-summary
      className="w-full rounded-xl border border-warm-grey bg-white px-4 py-3 lg:w-[22rem] lg:shrink-0"
    >
      <div className="grid grid-cols-[1fr_3.5rem_3.5rem] items-end gap-3 pb-1 text-[0.5625rem] font-bold uppercase tracking-wide text-mid-grey">
        <span>Attendance</span>
        <span className="text-right">Last 4</span>
        <span className="text-right">YTD</span>
      </div>
      <AttendanceSummaryRow label="Connect Group" recent={attendance.summary.connectGroup.recentPercentage} ytd={attendance.summary.connectGroup.ytdPercentage} />
      <AttendanceSummaryRow label="Church" recent={attendance.summary.church.recentPercentage} ytd={attendance.summary.church.ytdPercentage} />
    </aside>
  )
}

function AttendanceBar({
  id,
  label,
  percentage,
  color,
}: {
  id: string
  label: string
  percentage: number | null
  color: string
}) {
  const hasData = percentage !== null
  const value = percentage ?? 0
  const displayValue = hasData ? `${value}%` : 'No data'
  return (
    <span className="group relative flex h-full w-2.5 items-end sm:w-4">
      <span
        aria-describedby={id}
        aria-label={`${label}, ${displayValue}`}
        tabIndex={0}
        className={`w-full rounded-t outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-1 ${color}`}
        style={{ height: `${value}%` }}
      />
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 rounded bg-brand-black px-1.5 py-1 text-[0.625rem] font-bold leading-none text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        style={{ bottom: `calc(${value}% + 0.375rem)` }}
      >
        {displayValue}
      </span>
    </span>
  )
}

export function ConnectGroupAttendanceTrend({ attendance }: { attendance: GroupAttendanceOverview }) {
  if (!attendance.monthly.some((month) => month.connectGroupPercentage !== null || month.churchPercentage !== null)) return null
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-2xl text-brand-black">Attendance</h2>
      <div className="rounded-xl border border-warm-grey bg-white p-4 sm:p-5">
        <div className="mb-5 flex gap-4 text-[0.6875rem] text-mid-grey">
          <span className="before:mr-1.5 before:inline-block before:h-2 before:w-2 before:bg-rich-red">Connect Group</span>
          <span className="before:mr-1.5 before:inline-block before:h-2 before:w-2 before:bg-mid-grey">Church</span>
        </div>
        <div className="grid grid-cols-[2rem_1fr] gap-2">
          <div aria-hidden="true" className="h-44 pb-7">
            <div className="flex h-full flex-col justify-between text-right text-[0.5625rem] leading-none text-mid-grey">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
          </div>
          <div className="relative grid h-44 grid-cols-6 items-end gap-2 px-1">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-1 bottom-7 top-0 flex flex-col justify-between">
              <span className="border-t border-warm-grey/60" />
              <span className="border-t border-warm-grey/60" />
              <span className="border-t border-warm-grey/60" />
              <span className="border-t border-warm-grey/60" />
              <span className="border-t border-warm-grey/60" />
            </div>
            {attendance.monthly.map((month) => {
              const label = new Intl.DateTimeFormat('en-NZ', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month.month}-01T00:00:00.000Z`))
              return (
                <div key={month.month} className="relative z-10 flex h-full min-w-0 flex-col justify-end">
                  <div className="flex min-h-0 flex-1 items-end justify-center gap-1">
                    <AttendanceBar id={`${month.month}-connect-group-attendance`} label={`${label} Connect Group`} percentage={month.connectGroupPercentage} color="bg-rich-red" />
                    <AttendanceBar id={`${month.month}-church-attendance`} label={`${label} Church`} percentage={month.churchPercentage} color="bg-mid-grey" />
                  </div>
                  <span className="flex h-7 items-center justify-center text-center text-[0.625rem] text-mid-grey">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
