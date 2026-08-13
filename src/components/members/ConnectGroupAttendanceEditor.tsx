'use client'

import { useRef, useState, useTransition } from 'react'

import {
  loadAttendanceMeetingAction,
  saveAttendanceAction,
} from '@/app/(frontend)/members/connect-groups/[rockGroupId]/attendance/actions'
import type {
  AttendanceMarkState,
  AttendanceMeetingIdentity,
  ConnectGroupAttendanceMeeting,
} from '@/lib/members/attendance-entry'
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
  const [meetingIndex, setMeetingIndex] = useState(() => Math.max(0, meetings.findIndex((meeting) => sameMeeting(meeting, initialMeeting.identity))))
  const [meeting, setMeeting] = useState(() => markUnrecordedPresent(initialMeeting))
  const [message, setMessage] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const requestSequence = useRef(0)

  const present = people.filter((person) => meeting.marks[person.rockPersonId] === 'present').length
  const absent = people.filter((person) => meeting.marks[person.rockPersonId] === 'absent').length
  const unrecorded = people.length - present - absent
  const saveDisabled = isPending || loadFailed || (!meeting.didNotMeet && unrecorded > 0)

  function selectMeeting(nextIndex: number) {
    setMeetingIndex(nextIndex)
    setMessage(null)
    setLoadFailed(false)
    const sequence = ++requestSequence.current
    const identity = meetings[nextIndex]
    if (sameMeeting(identity, meeting.identity)) return
    startTransition(async () => {
      let loaded = null
      try {
        loaded = await loadAttendanceMeetingAction(rockGroupId, identity)
      } catch {
        // Keep the prior canonical meeting visible but non-writable.
      }
      if (sequence !== requestSequence.current) return
      if (!loaded) {
        setLoadFailed(true)
        setMessage('This meeting could not be loaded. Reload the page and try again.')
        return
      }
      setMeeting(markUnrecordedPresent(loaded))
    })
  }

  function setMark(personId: number, state: AttendanceMarkState) {
    setMeeting((current) => ({ ...current, marks: { ...current.marks, [personId]: state } }))
    setMessage(null)
  }

  function save() {
    if (saveDisabled) return
    setMessage(null)
    startTransition(async () => {
      let result
      try {
        result = await saveAttendanceAction(rockGroupId, {
          meeting: meeting.identity,
          marks: meeting.marks,
          notes: meeting.notes,
          didNotMeet: meeting.didNotMeet,
        })
      } catch {
        setMessage('Attendance could not be saved. Reload before trying again.')
        return
      }
      if (result.status === 'saved') {
        setMeeting(result.state)
        setMessage('Attendance saved.')
        return
      }
      setMessage(result.message)
    })
  }

  return (
    <form action={save} className="space-y-4">
      <div>
        <label htmlFor="attendance-meeting" className="mb-2 block text-sm font-bold text-brand-black">Meeting</label>
        <select
          id="attendance-meeting"
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
          type="checkbox"
          checked={meeting.didNotMeet}
          disabled={isPending || loadFailed}
          onChange={(event) => setMeeting((current) => ({ ...current, didNotMeet: event.target.checked }))}
          className="h-5 w-5 accent-rich-red"
        />
        Group did not meet
      </label>

      {isPending && <p role="status" aria-live="polite" className="text-sm text-mid-grey">Updating attendance…</p>}

      <div className="overflow-hidden rounded-xl border border-warm-grey bg-white" aria-busy={isPending}>
        {people.map((person) => (
          <fieldset key={person.rockPersonId} disabled={meeting.didNotMeet || isPending || loadFailed} className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3 border-t border-warm-grey px-3 py-2.5 first:border-t-0 sm:grid-cols-[1fr_10rem] sm:px-4">
            <legend className="sr-only">Attendance for {person.name}</legend>
            <div className="flex min-w-0 items-center gap-2.5">
              <MemberAvatar name={person.name} src={person.avatarUrl} size="small" />
              <span aria-hidden="true" className="truncate text-sm font-bold text-brand-black sm:text-base">{person.name}</span>
            </div>
            <div role="radiogroup" aria-label={`Attendance for ${person.name}`} className="relative grid grid-cols-2 rounded-lg bg-[#f2efeb] p-1">
              <span
                aria-hidden="true"
                className={`absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-md bg-brand-black shadow-sm transition-transform duration-200 ease-out ${meeting.marks[person.rockPersonId] === 'absent' ? 'translate-x-full' : 'translate-x-0'}`}
              />
              {(['present', 'absent'] as const).map((state) => {
                const checked = meeting.marks[person.rockPersonId] === state
                return (
                  <label key={state} className={`relative z-10 flex min-h-10 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-bold transition-colors duration-200 sm:text-sm ${checked ? 'text-white' : 'text-brand-black'}`}>
                    <input className="sr-only" type="radio" name={`person-${person.rockPersonId}`} value={state} checked={checked} onChange={() => setMark(person.rockPersonId, state)} />
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
        <textarea id="meeting-notes" value={meeting.notes} disabled={isPending || loadFailed} onChange={(event) => setMeeting((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full rounded-xl border border-warm-grey bg-white px-4 py-3 text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black" />
      </div>

      <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-brand-black">
          {meeting.didNotMeet ? 'No individual attendance' : `${present} present · ${absent} absent${unrecorded ? ` · ${unrecorded} unmarked` : ''}`}
        </p>
        <button type="submit" disabled={saveDisabled} className="min-h-12 rounded-lg bg-rich-red px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-black disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? 'Saving…' : 'Save attendance'}
        </button>
      </div>
      {!meeting.didNotMeet && unrecorded > 0 && <p role="alert" className="text-sm font-bold text-rich-red">Please mark every person present or absent before saving.</p>}
      {message && <p role={message === 'Attendance saved.' ? 'status' : 'alert'} aria-live="polite" className="text-sm font-bold text-brand-black">{message}</p>}
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

function markUnrecordedPresent(meeting: ConnectGroupAttendanceMeeting) {
  return {
    ...meeting,
    marks: Object.fromEntries(Object.entries(meeting.marks).map(([personId, state]) => [
      personId,
      state === 'unrecorded' ? 'present' : state,
    ])) as Record<number, AttendanceMarkState>,
  }
}
