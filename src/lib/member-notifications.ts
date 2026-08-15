import type {
  VolunteerScheduleAssignment,
  VolunteerScheduleResult,
} from '@/lib/members/volunteer-scheduling'

import {
  isMemberNotificationHref,
  MEMBER_NOTIFICATION_LIST_LIMIT,
  MEMBER_NOTIFICATIONS_OVERFLOW_HREF,
  UNAVAILABLE_MEMBER_NOTIFICATIONS,
  type AvailableMemberNotifications,
  type MemberNotification,
  type MemberNotificationsResult,
  type RockScheduleRequestNotification,
} from './member-notification-contract'

export {
  MEMBER_NOTIFICATION_LIST_LIMIT,
  MEMBER_NOTIFICATIONS_OVERFLOW_HREF,
  type MemberNotification,
  type MemberNotificationsResult,
} from './member-notification-contract'

const ROCK_SCHEDULE_ID_PATTERN = /^rock-schedule:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/iu
const GENERIC_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}:[a-z0-9._~-]{1,200}$/iu
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u

function isSafeText(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximumLength &&
    value.trim() === value &&
    !CONTROL_CHARACTERS.test(value)
  )
}

function isValidNotification(value: unknown): value is MemberNotification {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const item = value as Partial<MemberNotification>
  return (
    (item.kind === 'rock-schedule-request' || item.kind === 'system') &&
    isSafeText(item.id, 240) &&
    GENERIC_ID_PATTERN.test(item.id) &&
    isSafeText(item.title, 200) &&
    isSafeText(item.summary, 300) &&
    isMemberNotificationHref(item.href) &&
    typeof item.startsAt === 'string' &&
    Number.isFinite(Date.parse(item.startsAt)) &&
    typeof item.requiresAction === 'boolean'
  )
}

function compareNotifications(left: MemberNotification, right: MemberNotification) {
  return Date.parse(left.startsAt) - Date.parse(right.startsAt) || left.id.localeCompare(right.id)
}

export function normalizeMemberNotifications(
  notifications: readonly MemberNotification[],
): AvailableMemberNotifications {
  const byId = new Map<string, MemberNotification>()
  for (const notification of notifications as readonly unknown[]) {
    if (!isValidNotification(notification) || byId.has(notification.id)) continue
    byId.set(notification.id, notification)
  }

  const allItems = [...byId.values()].sort(compareNotifications)
  return {
    status: 'available',
    actionableCount: allItems.filter(({ requiresAction }) => requiresAction).length,
    items: allItems.slice(0, MEMBER_NOTIFICATION_LIST_LIMIT),
    overflowHref: MEMBER_NOTIFICATIONS_OVERFLOW_HREF,
    hasMore: allItems.length > MEMBER_NOTIFICATION_LIST_LIMIT,
  }
}

function scheduleRequestNotification(
  assignment: VolunteerScheduleAssignment,
): RockScheduleRequestNotification | null {
  const idMatch = typeof assignment?.id === 'string'
    ? ROCK_SCHEDULE_ID_PATTERN.exec(assignment.id)
    : null
  if (
    !idMatch ||
    !isSafeText(assignment.title, 200) ||
    typeof assignment.occurrenceStart !== 'string' ||
    !Number.isFinite(Date.parse(assignment.occurrenceStart)) ||
    !(assignment.scheduleName === null || isSafeText(assignment.scheduleName, 200)) ||
    !(assignment.locationName === null || isSafeText(assignment.locationName, 200))
  ) return null

  const summary = [assignment.scheduleName, assignment.locationName]
    .filter((value): value is string => value !== null)
    .join(' · ') || 'Service request'
  const guid = idMatch[1].toLowerCase()

  return {
    id: `rock-schedule:${guid}`,
    kind: 'rock-schedule-request',
    title: assignment.title,
    summary,
    href: `/members/my-service#rock-schedule:${guid}`,
    startsAt: assignment.occurrenceStart,
    requiresAction: true,
  }
}

export function buildMemberNotifications(
  schedule: VolunteerScheduleResult,
): MemberNotificationsResult {
  if (schedule.status !== 'available') {
    return UNAVAILABLE_MEMBER_NOTIFICATIONS
  }

  return normalizeMemberNotifications(
    (schedule.requests as readonly VolunteerScheduleAssignment[])
      .map(scheduleRequestNotification)
      .filter((item): item is RockScheduleRequestNotification => item !== null),
  )
}
