'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { HiOutlineCalendarDays, HiOutlineMapPin, HiOutlineUsers } from 'react-icons/hi2'

import { CONNECT_GROUP_LAUNCHER_TARGET } from '@/lib/connect-groups/constants'
import type { PublicConnectGroup } from '@/lib/connect-groups/public'

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-4 focus:ring-rich-red/25 ${
        active
          ? 'border-rich-red bg-rich-red text-white'
          : 'border-brand-black/15 bg-white text-brand-black hover:border-rich-red hover:text-rich-red'
      }`}
    >
      {children}
    </button>
  )
}

function registerHref(groupGuid: string) {
  const params = new URLSearchParams({
    launcher: CONNECT_GROUP_LAUNCHER_TARGET,
    groupGuid,
  })
  return `?${params.toString()}`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/u)
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts.at(-1)?.[0] ?? '' : ''}`.toUpperCase()
}

function LeaderAvatar({
  leader,
}: {
  leader: PublicConnectGroup['leaders'][number]
}) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-warm-grey text-xs font-bold text-brand-black shadow-sm"
      aria-hidden="true"
      title={leader.name}
    >
      {leader.avatarUrl && !imageFailed ? (
        // Rock serves these same public leader avatars on its Connect Groups page.
        <img
          src={leader.avatarUrl}
          alt=""
          width={36}
          height={36}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials(leader.name)
      )}
    </span>
  )
}

export function ConnectGroupsFinder({ groups }: { groups: PublicConnectGroup[] }) {
  const [campus, setCampus] = useState('all')
  const [day, setDay] = useState<number | 'all'>('all')

  const campuses = useMemo(
    () =>
      Array.from(
        new Map(groups.map((group) => [group.campus.slug, group.campus])).values(),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [groups],
  )
  const days = useMemo(
    () =>
      Array.from(
        new Set(
          groups.flatMap((group) =>
            group.meetingDay === null ? [] : [group.meetingDay],
          ),
        ),
      ).sort((a, b) => a - b),
    [groups],
  )
  const visibleGroups = groups.filter(
    (group) =>
      (campus === 'all' || group.campus.slug === campus) &&
      (day === 'all' || group.meetingDay === day),
  )

  return (
    <div>
      <div className="space-y-5" aria-label="Filter Connect Groups">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-dark-grey">
            Campus
          </p>
          <div className="flex flex-wrap gap-2">
            <FilterButton active={campus === 'all'} onClick={() => setCampus('all')}>
              All campuses
            </FilterButton>
            {campuses.map((option) => (
              <FilterButton
                key={option.slug}
                active={campus === option.slug}
                onClick={() => setCampus(option.slug)}
              >
                {option.name}
              </FilterButton>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-dark-grey">
            Meeting day
          </p>
          <div className="flex flex-wrap gap-2">
            <FilterButton active={day === 'all'} onClick={() => setDay('all')}>
              Any day
            </FilterButton>
            {days.map((option) => (
              <FilterButton
                key={option}
                active={day === option}
                onClick={() => setDay(option)}
              >
                {DAY_NAMES[option]}
              </FilterButton>
            ))}
          </div>
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-warm-grey/35 p-6 text-dark-grey" role="status">
          No Connect Groups match those filters. Try another campus or meeting day.
        </p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.map((group) => (
            <article
              key={group.id}
              className="flex h-full flex-col rounded-2xl border border-brand-black/10 bg-white p-6 shadow-sm"
            >
              <h3 className="text-2xl leading-tight text-brand-black">
                {group.publicName}
              </h3>
              <dl className="mt-5 space-y-3 text-sm text-dark-grey">
                <div className="flex gap-3">
                  <HiOutlineMapPin className="mt-0.5 h-5 w-5 shrink-0 text-rich-red" aria-hidden="true" />
                  <div>
                    <dt className="sr-only">Campus</dt>
                    <dd>{group.campus.name}</dd>
                  </div>
                </div>
                {group.scheduleText && (
                  <div className="flex gap-3">
                    <HiOutlineCalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-rich-red" aria-hidden="true" />
                    <div>
                      <dt className="sr-only">Meeting time</dt>
                      <dd>{group.scheduleText}</dd>
                    </div>
                  </div>
                )}
                {group.leaders.length > 0 && (
                  <div className="flex gap-3">
                    <HiOutlineUsers className="mt-2 h-5 w-5 shrink-0 text-rich-red" aria-hidden="true" />
                    <div>
                      <dt className="sr-only">Leaders</dt>
                      <dd>
                        <span className="flex -space-x-2">
                          {group.leaders.map((leader) => (
                            <LeaderAvatar key={leader.name} leader={leader} />
                          ))}
                        </span>
                        <span className="mt-2 block">
                          {group.leaders.map((leader) => leader.name).join(', ')}
                        </span>
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
              <Link
                href={registerHref(group.rockGroupGuid)}
                scroll={false}
                className="mt-6 inline-flex min-h-11 items-center justify-center self-start rounded-full bg-rich-red px-6 text-sm font-bold text-white transition-colors hover:bg-deep-red focus:outline-none focus:ring-4 focus:ring-rich-red/25"
              >
                Register
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
