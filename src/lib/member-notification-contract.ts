export const MEMBER_NOTIFICATION_LIST_LIMIT = 5
export const MEMBER_NOTIFICATIONS_OVERFLOW_HREF = '/members/my-service' as const
export const MEMBER_NOTIFICATIONS_REFRESH_EVENT = 'member-notifications:refresh'

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u

interface NotificationFields {
  id: string
  title: string
  summary: string
  href: string
  startsAt: string
  requiresAction: boolean
}

export interface RockScheduleRequestNotification extends NotificationFields {
  kind: 'rock-schedule-request'
}

export interface SystemNotification extends NotificationFields {
  kind: 'system'
}

export type MemberNotification = RockScheduleRequestNotification | SystemNotification

export interface AvailableMemberNotifications {
  status: 'available'
  actionableCount: number
  items: MemberNotification[]
  overflowHref: typeof MEMBER_NOTIFICATIONS_OVERFLOW_HREF
  hasMore: boolean
}

export interface UnavailableMemberNotifications {
  status: 'unavailable'
  actionableCount: 0
  items: []
  overflowHref: typeof MEMBER_NOTIFICATIONS_OVERFLOW_HREF
  hasMore: false
}

export type MemberNotificationsResult =
  | AvailableMemberNotifications
  | UnavailableMemberNotifications

export const UNAVAILABLE_MEMBER_NOTIFICATIONS = {
  status: 'unavailable',
  actionableCount: 0,
  items: [],
  overflowHref: MEMBER_NOTIFICATIONS_OVERFLOW_HREF,
  hasMore: false,
} as const satisfies UnavailableMemberNotifications

export function isMemberNotificationHref(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /%(?:2f|5c)/iu.test(value) ||
    CONTROL_CHARACTERS.test(value)
  ) return false

  try {
    const parsed = new URL(value, 'https://www.ev.church')
    return parsed.origin === 'https://www.ev.church' && (
      parsed.pathname === '/members' || parsed.pathname.startsWith('/members/')
    )
  } catch {
    return false
  }
}
