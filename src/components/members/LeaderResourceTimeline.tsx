import Link from 'next/link'

import type { MemberLeaderResource } from '@/lib/members/data'
import { leaderResourceMedia } from '@/lib/members/leader-resource-media'

import { formatResourceDates } from './LeaderResourceCard'
import { LeaderResourceVideoButton } from './LeaderResourceVideoButton'
import Image from 'next/image'

const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
  '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job',
  'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
  'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai',
  'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John',
  '2 John', '3 John', 'Jude', 'Revelation',
] as const

const BIBLE_BOOK_ALIASES = [
  ...BIBLE_BOOKS.map((book) => [book, book] as const),
  ...BIBLE_BOOKS
    .filter((book) => /^\d /u.test(book))
    .map((book) => [book.replace(' ', ''), book] as const),
  ['Number', 'Numbers'] as const,
  ['Psalm', 'Psalms'] as const,
  ['Song of Songs', 'Song of Solomon'] as const,
].sort(([a], [b]) => b.length - a.length)

function textContainsBook(text: string, candidate: string) {
  const start = text.toLocaleLowerCase('en-NZ')
  const book = candidate.toLocaleLowerCase('en-NZ')
  let index = start.indexOf(book)
  while (index >= 0) {
    const before = start[index - 1]
    const after = start[index + book.length]
    const startsAtBoundary = before === undefined || !/[a-z]/u.test(before)
    const endsAtBoundary = after === undefined || !/[a-z]/u.test(after)
    if (startsAtBoundary && endsAtBoundary) return true
    index = start.indexOf(book, index + 1)
  }
  return false
}

function bibleBookForResource(resource: MemberLeaderResource) {
  const sources = [resource.bibleReference, resource.title].filter(
    (source): source is string => Boolean(source),
  )
  for (const source of sources) {
    const match = BIBLE_BOOK_ALIASES.find(([candidate]) => (
      textContainsBook(source, candidate)
    ))
    if (match) return match[1]
  }
  return null
}

export interface LeaderResourceSeries {
  book: string | null
  resources: MemberLeaderResource[]
}

export function groupResourcesByBibleBook(
  resources: MemberLeaderResource[],
): LeaderResourceSeries[] {
  const groups: LeaderResourceSeries[] = []

  for (const resource of resources) {
    const detectedBook = bibleBookForResource(resource)
    const previous = groups.at(-1)
    const book = detectedBook ?? previous?.book ?? null

    if (!previous || (detectedBook !== null && detectedBook !== previous.book)) {
      groups.push({ book, resources: [resource] })
    } else {
      previous.resources.push(resource)
    }
  }

  return groups
}

function FileIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8m-6-6 6 6m-6-6v6h6M8 14h8m-8 4h5" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5v14l11-7-11-7z" />
    </svg>
  )
}

function isLeaderLaunch(resource: MemberLeaderResource) {
  return /\bCG Leaders Launch\b/iu.test(resource.title)
}

function hostNames(resource: MemberLeaderResource) {
  return resource.hosts.map((host) => host.name).join(' & ')
}

function ResourceActions({ resource, inverted = false, audience = 'leader' }: {
  resource: MemberLeaderResource
  inverted?: boolean
  audience?: 'leader' | 'member'
}) {
  const video = audience === 'leader' ? leaderResourceMedia(resource) : null
  const primaryClass = inverted
    ? 'bg-white text-rich-red hover:bg-warm-white'
    : 'bg-rich-red text-white hover:bg-deep-red'
  const secondaryClass = inverted
    ? 'border-white/60 text-white hover:bg-white/10'
    : 'border-brand-black text-brand-black hover:bg-brand-black hover:text-white'

  return (
    <div className="flex flex-wrap gap-3">
      {video && (
        <LeaderResourceVideoButton
          media={video}
          variant={inverted ? 'featured' : 'action'}
          size={inverted ? 'sm' : 'md'}
          className={inverted ? undefined : 'inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-black'}
        />
      )}
      {audience === 'leader' && resource.hasLeaderNotes && (
        <a
          href={`/members/connect-group-leader-resources/${resource.rockId}/files/leader-notes`}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-bold transition-colors ${inverted ? secondaryClass : primaryClass}`}
        >
          <FileIcon /> {inverted ? 'Notes' : 'Leader notes'}
        </a>
      )}
      {resource.hasMemberStudy && (
        <a
          href={`/members/connect-group-leader-resources/${resource.rockId}/files/member-study`}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-bold transition-colors ${secondaryClass}`}
        >
          <FileIcon /> {inverted ? 'Study' : 'Member study'}
        </a>
      )}
      {audience === 'leader' && !video && !resource.hasLeaderNotes && !resource.hasMemberStudy && (
        <Link
          href={`/members/connect-group-leader-resources/${resource.rockId}`}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition-colors ${primaryClass}`}
        >
          Open resource <ArrowIcon />
        </Link>
      )}
    </div>
  )
}

function LaunchResource({ resource }: { resource: MemberLeaderResource }) {
  const video = leaderResourceMedia(resource)

  return (
    <div className="grid gap-4 bg-brand-black px-5 py-5 text-white sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-7">
      {video ? (
        <LeaderResourceVideoButton media={video} />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40">
          <PlayIcon />
        </span>
      )}
      <div>
        <h3 className="text-lg leading-tight text-white">{resource.title}</h3>
        <p className="mt-1 text-sm text-white/65">
          {resource.bibleReference ?? 'Launch session and supporting material'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/members/connect-group-leader-resources/${resource.rockId}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-white hover:underline"
        >
          Open <ArrowIcon />
        </Link>
      </div>
    </div>
  )
}

function TimelineRows({ resources }: { resources: MemberLeaderResource[] }) {
  return (
    <div>
      {resources.map((resource, index) => {
        const dates = formatResourceDates(resource)
        const hosts = hostNames(resource)
        const video = leaderResourceMedia(resource)
        return (
          <article
            key={resource.rockId}
            className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[7.5rem_2rem_minmax(0,1fr)_auto] sm:gap-x-5"
          >
            <p className="col-start-2 mb-2 text-xs font-bold uppercase tracking-[0.12em] text-mid-grey sm:col-start-1 sm:row-start-1 sm:mb-0 sm:text-right">
              {dates}
            </p>
            <div className="relative col-start-1 row-start-1 row-span-3 sm:col-start-2">
              {index < resources.length - 1 && (
                <span className="absolute bottom-0 left-1/2 top-3 w-px -translate-x-1/2 bg-warm-grey" />
              )}
              {video ? (
                <LeaderResourceVideoButton media={video} />
              ) : (
                <span className="relative mt-1 block h-2.5 w-2.5 rounded-full bg-rich-red ring-4 ring-warm-white" />
              )}
            </div>
            <div className="col-start-2 pb-9 sm:col-start-3 sm:row-start-1">
              <Link
                href={`/members/connect-group-leader-resources/${resource.rockId}`}
                className="text-xl leading-tight text-brand-black transition-colors hover:text-rich-red"
              >
                {resource.title}
              </Link>
              {(resource.bibleReference || hosts) && (
                <p className="mt-2 text-sm text-mid-grey">
                  {[resource.bibleReference, hosts].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="col-start-2 flex gap-4 pb-9 text-sm font-bold text-rich-red sm:col-start-4 sm:row-start-1 sm:pb-0">
              {resource.hasLeaderNotes && (
                <a href={`/members/connect-group-leader-resources/${resource.rockId}/files/leader-notes`} className="hover:underline">Notes</a>
              )}
              {resource.hasMemberStudy && (
                <a href={`/members/connect-group-leader-resources/${resource.rockId}/files/member-study`} className="hover:underline">Study</a>
              )}
              {!video && !resource.hasLeaderNotes && !resource.hasMemberStudy && (
                <Link href={`/members/connect-group-leader-resources/${resource.rockId}`} className="hover:underline">Open</Link>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function SeriesTimeline({ resources }: { resources: MemberLeaderResource[] }) {
  return (
    <div className="space-y-16">
      {groupResourcesByBibleBook(resources).map((series, index) => {
        const artwork = series.resources.find((resource) => resource.promotionalImageUrl)?.promotionalImageUrl
        return (
          <section key={`${series.book ?? 'unlabelled'}-${index}`}>
            <div className={artwork ? 'grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start lg:gap-10' : ''}>
              {artwork && (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-brand-black">
                  {/* Public, same-origin route so Next can optimize the artwork. */}
                  <Image
                    src={artwork}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <TimelineRows resources={series.resources} />
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function LeaderResourceTimeline({
  current,
  upcoming,
  history,
}: {
  current: MemberLeaderResource[]
  upcoming: MemberLeaderResource[]
  history: MemberLeaderResource[]
}) {
  const primary = current.find((resource) => !isLeaderLaunch(resource)) ?? current[0]
  const otherCurrent = current.filter((resource) => (
    resource.rockId !== primary?.rockId && !isLeaderLaunch(resource)
  ))

  return (
    <>
      {primary ? <LeaderResourceThisWeek current={current} /> : (
        <section aria-labelledby="this-week-heading" className="border-y border-warm-grey py-8">
          <h3 id="this-week-heading" className="text-2xl text-brand-black">This week</h3>
          <p className="mt-2 text-sm text-mid-grey">There is no current resource this week.</p>
        </section>
      )}

      {otherCurrent.length > 0 && (
        <section className="mt-12" aria-labelledby="other-current-heading">
          <h3 id="other-current-heading" className="mb-7 border-b-2 border-brand-black pb-3 text-2xl text-brand-black">Other current resources</h3>
          <TimelineRows resources={otherCurrent} />
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-14" aria-labelledby="upcoming-heading">
          <h3 id="upcoming-heading" className="mb-7 border-b-2 border-brand-black pb-3 text-2xl text-brand-black">Coming up</h3>
          <SeriesTimeline resources={upcoming} />
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-14" aria-label="Earlier resources">
          <SeriesTimeline resources={history} />
        </section>
      )}
    </>
  )
}

export function LeaderResourceThisWeek({
  current,
  audience = 'leader',
}: {
  current: MemberLeaderResource[]
  audience?: 'leader' | 'member'
}) {
  const primary = current.find((resource) => !isLeaderLaunch(resource)) ?? current[0]
  if (!primary) return null

  const currentLaunches = audience === 'leader' ? current.filter((resource) => (
    isLeaderLaunch(resource) && resource.rockId !== primary.rockId
  )) : []
  const primaryHosts = audience === 'leader' ? hostNames(primary) : ''
  const primaryDates = formatResourceDates(primary)

  return (
    <section aria-labelledby="this-week-heading" className="overflow-hidden rounded-xl shadow-xl shadow-brand-black/10">
      <div className="relative overflow-hidden bg-rich-red text-white">
        {primary.promotionalImageUrl && (
          <div className="relative aspect-video w-full overflow-hidden bg-brand-black lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-1/2 lg:aspect-auto">
            {/* Public, same-origin route so Next can optimize the artwork. */}
            <Image
              src={primary.promotionalImageUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-contain"
            />
          </div>
        )}
        <div className={`relative px-6 py-8 sm:px-9 sm:py-10 ${primary.promotionalImageUrl ? 'lg:pr-[52%]' : ''}`}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/80">
            {['This week', primaryDates].filter(Boolean).join(' · ')}
          </p>
          <h3 id="this-week-heading" className="mt-3 text-4xl leading-none text-white sm:text-5xl">
            {audience === 'leader' ? (
              <Link
                href={`/members/connect-group-leader-resources/${primary.rockId}`}
                className="hover:underline"
              >
                {primary.title}
              </Link>
            ) : primary.title}
          </h3>
          {(primary.bibleReference || primaryHosts) && (
            <p className="mt-4 text-sm text-white/80">
              {[primary.bibleReference, primaryHosts].filter(Boolean).join(' · ')}
            </p>
          )}
          {primary.description && (
            <p className="mt-5 line-clamp-3 max-w-2xl text-base leading-relaxed text-white/85">{primary.description}</p>
          )}
          {(audience === 'leader' || primary.hasMemberStudy) && (
            <div className="mt-7">
              <ResourceActions resource={primary} inverted audience={audience} />
            </div>
          )}
        </div>
      </div>
      {currentLaunches.map((resource) => (
        <LaunchResource key={resource.rockId} resource={resource} />
      ))}
    </section>
  )
}
