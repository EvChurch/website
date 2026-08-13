import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  getEntry: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/lib/members/data', () => ({
  authorizeConnectGroupAttendanceLeader: mocks.authorize,
}))

vi.mock('@/lib/members/attendance-entry', () => ({
  getConnectGroupAttendanceEntry: mocks.getEntry,
}))

vi.mock('@/components/members/ConnectGroupAttendanceEditor', () => ({
  ConnectGroupAttendanceEditor: ({ people }: { people: Array<{ name: string }> }) => (
    <section>Attendance editor for {people.map((person) => person.name).join(', ')}</section>
  ),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}))

import ConnectGroupAttendancePage from './page'

const context = {
  access: 'granted' as const,
  actorRockPersonId: 42,
  group: {
    rockGroupId: 10,
    name: 'Tuesday Central Connect',
    campusName: 'Central',
    campusSlug: 'central',
    locationName: 'Mt Eden',
    locationAddress: 'Auckland',
    isLeader: true,
    roleName: 'Leader',
  },
  people: [{
    rockPersonId: 42,
    name: 'Aroha Ngata',
    email: 'aroha@example.com',
    phones: [],
    avatarUrl: null,
    roleName: 'Leader',
    isLeader: true,
    isCurrentMember: true,
  }],
}

describe('group-specific attendance route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEntry.mockResolvedValue({
      meetings: [{
        date: '2026-08-12',
        startDateTime: '2026-08-12T19:00:00',
        scheduleId: 3,
        locationId: 4,
        occurrenceId: null,
      }],
      selectedMeeting: {
        identity: {
          date: '2026-08-12',
          startDateTime: '2026-08-12T19:00:00',
          scheduleId: 3,
          locationId: 4,
          occurrenceId: null,
        },
        notes: '',
        didNotMeet: false,
        marks: { 42: 'present' },
      },
    })
  })

  it('preserves the exact route through sign-in', async () => {
    mocks.authorize.mockResolvedValue(null)

    await expect(ConnectGroupAttendancePage({
      params: Promise.resolve({ rockGroupId: '10' }),
    })).rejects.toThrow(
      'NEXT_REDIRECT:/auth/login?returnTo=%2Fmembers%2Fconnect-groups%2F10%2Fattendance',
    )
  })

  it.each(['not-a-number', '0', '-1'])('rejects malformed group id %s', async (rockGroupId) => {
    mocks.authorize.mockResolvedValue({ access: 'denied' })

    await expect(ConnectGroupAttendancePage({
      params: Promise.resolve({ rockGroupId }),
    })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.authorize).toHaveBeenCalledWith(Number(rockGroupId))
  })

  it('rejects a signed-in user who does not lead the requested active group', async () => {
    mocks.authorize.mockResolvedValue({ access: 'denied' })

    await expect(ConnectGroupAttendancePage({
      params: Promise.resolve({ rockGroupId: '10' }),
    })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('renders the authorized group and current roster context', async () => {
    mocks.authorize.mockResolvedValue(context)

    const markup = renderToStaticMarkup(await ConnectGroupAttendancePage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(markup).toContain('Tuesday Central Connect')
    expect(markup).toContain('Record attendance')
    expect(markup).toContain('Attendance editor for Aroha Ngata')
    expect(mocks.getEntry).toHaveBeenCalledWith(10, [42])
  })

  it('shows a fail-closed state when Rock cannot provide a meeting', async () => {
    mocks.authorize.mockResolvedValue(context)
    mocks.getEntry.mockRejectedValue(new Error('schedule unavailable'))

    const markup = renderToStaticMarkup(await ConnectGroupAttendancePage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(markup).toContain('Attendance is unavailable')
    expect(markup).not.toContain('Attendance editor for')
  })
})
