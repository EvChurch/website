import { describe, expect, it } from 'vitest'

import type { VolunteerScheduleResult } from '@/lib/members/volunteer-scheduling'

import {
  MEMBER_NOTIFICATION_LIST_LIMIT,
  buildMemberNotifications,
  normalizeMemberNotifications,
  type MemberNotification,
} from './member-notifications'

const GUIDS = {
  first: '11111111-1111-4111-8111-111111111111',
  second: '22222222-2222-4222-8222-222222222222',
}

function available(
  requests: Extract<VolunteerScheduleResult, { status: 'available' }>['requests'],
  upcoming: Extract<VolunteerScheduleResult, { status: 'available' }>['upcoming'] = [],
): VolunteerScheduleResult {
  return {
    status: 'available',
    requests,
    upcoming,
    nativeToolboxUrl: 'https://rock.ev.church/ScheduleToolbox',
  }
}

describe('member notifications', () => {
  it('maps only pending schedule requests to stable, chronological notification items', () => {
    const result = buildMemberNotifications(available([
      {
        id: `rock-schedule:${GUIDS.second}`,
        title: 'Youth Team',
        occurrenceStart: '2026-08-17T18:30:00+12:00',
        scheduleName: null,
        locationName: 'Youth Hall',
      },
      {
        id: `rock-schedule:${GUIDS.first}`,
        title: 'Welcome Team',
        occurrenceStart: '2026-08-16T09:00:00+12:00',
        scheduleName: '9am',
        locationName: 'Main Auditorium',
      },
    ], [{
      id: 'rock-schedule:33333333-3333-4333-8333-333333333333',
      title: 'Confirmed Team',
      occurrenceStart: '2026-08-15T08:00:00+12:00',
      scheduleName: null,
      locationName: null,
    }]))

    expect(result).toEqual({
      status: 'available',
      actionableCount: 2,
      items: [
        {
          id: `rock-schedule:${GUIDS.first}`,
          kind: 'rock-schedule-request',
          title: 'Welcome Team',
          summary: '9am · Main Auditorium',
          href: `/members/my-service#rock-schedule:${GUIDS.first}`,
          startsAt: '2026-08-16T09:00:00+12:00',
          requiresAction: true,
        },
        {
          id: `rock-schedule:${GUIDS.second}`,
          kind: 'rock-schedule-request',
          title: 'Youth Team',
          summary: 'Youth Hall',
          href: `/members/my-service#rock-schedule:${GUIDS.second}`,
          startsAt: '2026-08-17T18:30:00+12:00',
          requiresAction: true,
        },
      ],
      overflowHref: '/members/my-service',
      hasMore: false,
    })
  })

  it('returns available zero for confirmed-only and genuinely empty schedules', () => {
    const confirmed = buildMemberNotifications(available([], [{
      id: `rock-schedule:${GUIDS.first}`,
      title: 'Welcome Team',
      occurrenceStart: '2026-08-16T09:00:00+12:00',
      scheduleName: '9am',
      locationName: null,
    }]))
    const empty = buildMemberNotifications(available([]))

    expect(confirmed).toMatchObject({ status: 'available', actionableCount: 0, items: [] })
    expect(empty).toMatchObject({ status: 'available', actionableCount: 0, items: [] })
  })

  it('keeps unavailable distinct from available-empty', () => {
    expect(buildMemberNotifications({
      status: 'unavailable',
      reason: 'rock-unavailable',
      requests: [],
      upcoming: [],
      nativeToolboxUrl: null,
    })).toEqual({
      status: 'unavailable',
      actionableCount: 0,
      items: [],
      overflowHref: '/members/my-service',
      hasMore: false,
    })
  })

  it('rejects malformed provider data, deduplicates IDs, and generates destinations itself', () => {
    const requests = [
      {
        id: `rock-schedule:${GUIDS.first}`,
        title: 'Welcome Team',
        occurrenceStart: '2026-08-16T09:00:00+12:00',
        scheduleName: '9am',
        locationName: null,
        href: 'https://evil.example/steal',
      },
      {
        id: `rock-schedule:${GUIDS.first}`,
        title: 'Duplicate',
        occurrenceStart: '2026-08-18T09:00:00+12:00',
        scheduleName: null,
        locationName: null,
      },
      {
        id: 'rock-schedule:not-a-guid',
        title: 'Malformed',
        occurrenceStart: '2026-08-19T09:00:00+12:00',
        scheduleName: null,
        locationName: null,
      },
      {
        id: `rock-schedule:${GUIDS.second}`,
        title: 'Bad date',
        occurrenceStart: 'not-a-date',
        scheduleName: null,
        locationName: null,
      },
    ] as unknown as Extract<VolunteerScheduleResult, { status: 'available' }>['requests']

    const result = buildMemberNotifications(available(requests))

    expect(result.status).toBe('available')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.href).toBe(`/members/my-service#rock-schedule:${GUIDS.first}`)
    expect(JSON.stringify(result)).not.toContain('evil.example')
  })

  it('bounds the list without reducing the total actionable count', () => {
    const notifications = Array.from({ length: MEMBER_NOTIFICATION_LIST_LIMIT + 2 }, (_, index) => ({
      id: `system:${index}`,
      kind: 'system' as const,
      title: `Notice ${index}`,
      summary: 'Please review',
      href: '/members',
      startsAt: `2026-08-${String(index + 10).padStart(2, '0')}T09:00:00+12:00`,
      requiresAction: true,
    }))

    const result = normalizeMemberNotifications(notifications)

    expect(result.actionableCount).toBe(MEMBER_NOTIFICATION_LIST_LIMIT + 2)
    expect(result.items).toHaveLength(MEMBER_NOTIFICATION_LIST_LIMIT)
    expect(result.hasMore).toBe(true)
  })

  it('supports future informational kinds without counting them as actionable', () => {
    const notifications: MemberNotification[] = [{
      id: 'system:welcome',
      kind: 'system',
      title: 'Welcome',
      summary: 'Your profile is ready',
      href: '/members',
      startsAt: '2026-08-16T09:00:00+12:00',
      requiresAction: false,
    }]

    expect(normalizeMemberNotifications(notifications)).toMatchObject({
      actionableCount: 0,
      items: notifications,
    })
  })

  it.each([
    '/members/../auth/logout',
    '/members/%2e%2e/auth/logout',
    '/members/%2F..%2Fauth/logout',
    '/members/\\../auth/logout',
  ])('rejects member-path traversal destinations: %s', (href) => {
    const result = normalizeMemberNotifications([{
      id: 'system:unsafe',
      kind: 'system',
      title: 'Unsafe',
      summary: 'Do not follow',
      href,
      startsAt: '2026-08-16T09:00:00+12:00',
      requiresAction: true,
    }])

    expect(result).toMatchObject({ actionableCount: 0, items: [] })
  })
})
