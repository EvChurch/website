'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { HiExclamationTriangle } from 'react-icons/hi2'
import { useRouter } from 'next/navigation'

import {
  loadAttendanceMeetingAction,
  saveAttendanceAction,
} from '@/app/(frontend)/members/connect-groups/[rockGroupId]/attendance/actions'
import type {
  AttendanceMarkState,
  AttendanceMeetingIdentity,
  ConnectGroupAttendanceMeeting,
} from '@/lib/members/attendance-entry'
import { AttendanceAutosave } from './attendance-autosave'
import { MemberAvatar } from './MemberAvatar'

interface AttendancePerson {
  rockPersonId: number
  name: string
  avatarUrl: string | null
}

export function ConnectGroupAttendanceEditor({
  rockGroupId,
  meetings,
  initialMeeting,
  people,
}: {
  rockGroupId: number
  meetings: AttendanceMeetingIdentity[]
  initialMeeting: ConnectGroupAttendanceMeeting
  people: AttendancePerson[]
}) {
  const router = useRouter()
  const [, render] = useState(0)
  const [meetingIndex, setMeetingIndex] = useState(() => Math.max(0, meetings.findIndex((meeting) => sameMeeting(meeting, initialMeeting.identity))))
  const [loading, setLoading] = useState(false)
  const [loadMessage, setLoadMessage] = useState<string | null>(null)
  const [departure, setDeparture] = useState<(() => void) | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const requestSequence = useRef(0)
  const engineRef = useRef<AttendanceAutosave | null>(null)
  function createEngine(state: ConnectGroupAttendanceMeeting) {
    return new AttendanceAutosave(state, (request) => saveAttendanceAction(rockGroupId, {
      ...request, meeting: state.identity, rosterIds: people.map(person => person.rockPersonId),
    }), () => render(value => value + 1))
  }
  if (!engineRef.current) engineRef.current = createEngine(initialMeeting)
  const engine = engineRef.current
  const meeting = engine.meeting
  const message = loadMessage ?? engine.message
  const isPending = loading
  const loadFailed = loading
  const present = people.filter(person => meeting.marks[person.rockPersonId] === 'present').length
  const absent = people.filter(person => meeting.marks[person.rockPersonId] === 'absent').length
  const unrecorded = people.length - present - absent
  const saveDisabled = loading || engine.failed !== null

  async function navigate(action: () => void) {
    const leave = async () => { await removeHistoryGuard(); action() }
    if (await engineRef.current!.flush()) await leave()
    else setDeparture(() => { return () => { void leave() } })
  }

  useEffect(() => {
    engineRef.current?.activate()
    const warn = (event: BeforeUnloadEvent) => {
      if (engineRef.current?.dirty) { event.preventDefault(); event.returnValue = '' }
    }
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || !engineRef.current?.dirty) return
      event.preventDefault()
      event.stopPropagation()
      void navigate(() => { window.location.assign(anchor.href) })
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', click, true)
    return () => {
      engineRef.current?.dispose()
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('click', click, true)
    }
  // Event handlers read the current engine rather than a rendered snapshot.
  }, [])

  // Keep a same-page history entry only while edits are pending. Back first lands
  // on this page, allowing the draft to flush before the actual traversal.
  const historyGuard = useRef(false)
  const skipPop = useRef(false)
  const removingGuard = useRef<Promise<void> | null>(null)
  const finishRemovingGuard = useRef<(() => void) | null>(null)
  function removeHistoryGuard(): Promise<void> {
    if (removingGuard.current) return removingGuard.current
    if (!historyGuard.current) return Promise.resolve()
    historyGuard.current = false
    skipPop.current = true
    removingGuard.current = new Promise(resolve => { finishRemovingGuard.current = resolve })
    window.history.back()
    return removingGuard.current
  }
  useEffect(() => {
    if (engine.dirty && !historyGuard.current && !removingGuard.current) {
      window.history.pushState(window.history.state, '', window.location.href)
      historyGuard.current = true
    }
    const pop = () => {
      if (skipPop.current) {
        skipPop.current = false
        finishRemovingGuard.current?.()
        finishRemovingGuard.current = null
        removingGuard.current = null
        render(value => value + 1)
        return
      }
      if (!historyGuard.current) return
      historyGuard.current = false
      if (!engineRef.current?.dirty) { window.history.back(); return }
      window.history.pushState(window.history.state, '', window.location.href)
      historyGuard.current = true
      void navigate(() => {
        historyGuard.current = false
        window.history.back()
      })
    }
    window.addEventListener('popstate', pop)
    if (!engine.dirty) void removeHistoryGuard()
    return () => window.removeEventListener('popstate', pop)
  })

  function selectMeeting(nextIndex: number) {
    void navigate(() => {
      if (nextIndex === meetingIndex) return
      setLoading(true)
      setLoadMessage(null)
      const sequence = ++requestSequence.current
      void loadAttendanceMeetingAction(rockGroupId, meetings[nextIndex]).then(loaded => {
        if (sequence !== requestSequence.current) return
        if (!loaded) throw new Error('Meeting unavailable')
        engineRef.current!.dispose()
        engineRef.current = createEngine(loaded)
        setMeetingIndex(nextIndex)
      }).catch(() => {
        if (sequence === requestSequence.current) {
          engineRef.current!.activate()
          setLoadMessage('This meeting could not be loaded. Try selecting it again.')
        }
      }).finally(() => { if (sequence === requestSequence.current) setLoading(false) })
    })
  }

  function setMark(personId: number, state: AttendanceMarkState) {
    if (state !== 'unrecorded') engine.edit({ marks: { [personId]: state } })
  }

  function toggleDidNotMeet(checked: boolean) {
    if (checked && (present + absent > 0 || engine.dirty)) { setConfirmClear(true); return }
    engine.edit({ marks: {}, didNotMeet: checked })
  }

  async function save() {
    if (saveDisabled) return
    engine.edit({
      marks: meeting.didNotMeet ? {} : Object.fromEntries(people.map(person => [person.rockPersonId, meeting.marks[person.rockPersonId] === 'absent' ? 'absent' : 'present'])),
      notes: meeting.notes,
    })
    if (await engine.flush()) {
      await removeHistoryGuard()
      router.push(`/members/connect-groups/${rockGroupId}?attendance=saved`)
    }
  }

  return (
    <form action={save} className="space-y-4">
      <div>
        <select
          id="attendance-meeting"
          aria-label="Meeting date"
          value={meetingIndex}
          onChange={(event) => selectMeeting(Number(event.target.value))}
          disabled={isPending}
          className="min-h-12 w-full rounded-lg border border-warm-grey bg-white px-4 py-3 text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black"
        >
          {meetings.map((identity, index) => <option key={meetingKey(identity)} value={index}>{formattedDate(identity.date)}</option>)}
        </select>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-warm-grey bg-white px-4 py-2.5 font-bold text-brand-black">
        <input
          name="didNotMeet"
          aria-describedby="attendance-summary"
          type="checkbox"
          checked={meeting.didNotMeet}
          disabled={isPending || loadFailed}
          onChange={(event) => toggleDidNotMeet(event.target.checked)}
          className="h-5 w-5 accent-rich-red"
        />
        Group did not meet
      </label>

      <div className="overflow-hidden rounded-xl border border-warm-grey bg-white" aria-busy={isPending}>
        {people.map((person) => (
          <fieldset key={person.rockPersonId} disabled={meeting.didNotMeet || isPending || loadFailed} className="group grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3 border-t border-warm-grey px-3 py-2.5 first:border-t-0 disabled:opacity-50 sm:grid-cols-[1fr_10rem] sm:px-4">
            <legend className="sr-only">Attendance for {person.name}</legend>
            <div className="flex min-w-0 items-center gap-2.5">
              <MemberAvatar name={person.name} src={person.avatarUrl} size="small" />
              <span aria-hidden="true" className="truncate text-sm font-bold text-brand-black sm:text-base">{person.name}{meeting.marks[person.rockPersonId] === 'unrecorded' && !meeting.didNotMeet && <span className="block text-xs font-normal text-mid-grey">Not saved</span>}</span>
            </div>
            <div role="radiogroup" aria-label={`Attendance for ${person.name}`} className="relative grid grid-cols-2 rounded-lg bg-[#f2efeb] p-1">
              <span
                aria-hidden="true"
                className={`absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-md bg-brand-black shadow-sm transition-transform duration-200 ease-out ${meeting.marks[person.rockPersonId] === 'absent' ? 'translate-x-full' : 'translate-x-0'}`}
              />
              {(['present', 'absent'] as const).map((state) => {
                const checked = (meeting.marks[person.rockPersonId] === 'unrecorded' ? 'present' : meeting.marks[person.rockPersonId]) === state
                return (
                  <label key={state} className={`relative z-10 flex min-h-10 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-bold focus-within:ring-2 focus-within:ring-brand-black focus-within:ring-offset-2 group-disabled:cursor-not-allowed transition-colors duration-200 sm:text-sm ${checked ? 'text-white' : 'text-brand-black'}`}>
                    <input className="sr-only" type="radio" name={`person-${person.rockPersonId}`} value={state} checked={checked} onChange={() => {}} onClick={() => setMark(person.rockPersonId, state)} />
                    {state === 'present' ? 'Present' : 'Absent'}
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div>
        <label htmlFor="meeting-notes" className="mb-2 block text-sm font-bold text-brand-black">Meeting notes</label>
        <textarea id="meeting-notes" value={meeting.notes} disabled={isPending || loadFailed} maxLength={2000} onBlur={() => { void engine.flush() }} onChange={(event) => engine.edit({ marks: {}, notes: event.target.value }, 1000)} rows={3} className="w-full rounded-xl border border-warm-grey bg-white px-4 py-3 text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black" />
      </div>

      {message && (
        <div role="alert" aria-live="assertive" className="flex animate-fade-in items-start gap-3 rounded-xl border border-rich-red/25 bg-rich-red/5 px-4 py-3 text-sm font-semibold text-brand-black motion-reduce:animate-none">
          <HiExclamationTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rich-red" />
          <p>{message}</p>
        </div>
      )}

      <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-3">
        <p id="attendance-summary" className="text-sm font-bold text-brand-black">
          {meeting.didNotMeet ? 'No individual attendance' : `${present} present · ${absent} absent${unrecorded ? ` · ${unrecorded} not saved` : ''}`}
        </p>
        <button type="submit" disabled={saveDisabled} className="min-h-12 rounded-lg bg-rich-red px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-black disabled:cursor-not-allowed disabled:opacity-50">
          {engine.saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p role="status" className="text-sm text-mid-grey">{engine.saving ? 'Saving…' : engine.message ? 'Couldn’t save' : engine.saved ? 'Saved' : ''}</p>
      {engine.failed && <button type="button" onClick={() => { void engine.retry() }} className="min-h-11 font-bold text-rich-red">{engine.uncertain ? 'Check save status' : 'Retry'}</button>}
      {confirmClear && <AttendanceDialog label="Clear recorded attendance" onCancel={() => setConfirmClear(false)}>
        <p>Mark this meeting as not held and clear its attendance?</p>
        <button autoFocus type="button" className="min-h-11 mr-4 font-bold" onClick={() => setConfirmClear(false)}>Cancel</button>
        <button type="button" className="min-h-11 font-bold text-rich-red" onClick={() => { setConfirmClear(false); engine.edit({ marks: {}, didNotMeet: true, confirmClear: true }) }}>Clear attendance</button>
      </AttendanceDialog>}
      {departure && <AttendanceDialog label="Unsaved attendance" onCancel={() => setDeparture(null)}>
        <p>{engine.uncertain ? 'Some changes may already be saved, and a pending save may still complete.' : 'Some changes have not saved. Saved changes will remain.'}</p>
        <button autoFocus type="button" className="min-h-11 mr-4 font-bold" onClick={() => setDeparture(null)}>Stay</button>
        <button type="button" className="min-h-11 mr-4 font-bold" onClick={async () => { if (await engine.retry()) { setDeparture(null); departure() } }}>{engine.uncertain ? 'Check save status' : 'Retry'}</button>
        <button type="button" className="min-h-11 font-bold text-rich-red" onClick={() => { engine.dispose(); setDeparture(null); departure() }}>Leave anyway</button>
      </AttendanceDialog>}
    </form>
  )
}

function meetingKey(meeting: AttendanceMeetingIdentity) {
  return `${meeting.date}:${meeting.scheduleId}:${meeting.locationId ?? ''}:${meeting.occurrenceId ?? ''}`
}

function sameMeeting(left: AttendanceMeetingIdentity, right: AttendanceMeetingIdentity) {
  return meetingKey(left) === meetingKey(right)
}

function formattedDate(date: string) {
  return new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`))
}

function AttendanceDialog({ label, onCancel, children }: { label: string; onCancel: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} aria-label={label} onCancel={onCancel} className="m-auto max-w-md rounded-xl border border-rich-red bg-white p-5 backdrop:bg-brand-black/40">{children}</dialog>
}
