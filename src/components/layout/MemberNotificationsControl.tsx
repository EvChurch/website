'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

import {
  isMemberNotificationHref,
  MEMBER_NOTIFICATION_LIST_LIMIT,
  MEMBER_NOTIFICATIONS_REFRESH_EVENT,
  MEMBER_NOTIFICATIONS_OVERFLOW_HREF,
  type AvailableMemberNotifications,
  type MemberNotification,
} from '@/lib/member-notification-contract'

type NotificationTone = 'light' | 'dark'

type NotificationState =
  | { status: 'loading' }
  | { status: 'auth-required' }
  | { status: 'unavailable' }
  | AvailableMemberNotifications

interface MemberNotificationsControlProps {
  tone?: NotificationTone
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const MAX_AGE_MS = 60_000
const BACKGROUND_REFRESH_DEDUP_MS = 750
const DEFAULT_RETRY_AFTER_SECONDS = 5
const MAX_RETRY_AFTER_SECONDS = 30
const notificationDateFormatter = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'Pacific/Auckland',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})
function isNotificationItem(value: unknown): value is MemberNotification {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<MemberNotification>
  return (
    typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 240 &&
    typeof item.kind === 'string' && item.kind.length > 0 && item.kind.length <= 80 &&
    typeof item.title === 'string' && item.title.length > 0 && item.title.length <= 200 &&
    typeof item.summary === 'string' && item.summary.length > 0 && item.summary.length <= 300 &&
    isMemberNotificationHref(item.href) &&
    typeof item.startsAt === 'string' && Number.isFinite(Date.parse(item.startsAt)) &&
    typeof item.requiresAction === 'boolean'
  )
}

function parseNotificationState(value: unknown): NotificationState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value as Record<string, unknown>
  if (result.status === 'auth-required') return { status: 'auth-required' }
  if (result.status === 'unavailable') return { status: 'unavailable' }
  if (
    result.status !== 'available' ||
    !Number.isSafeInteger(result.actionableCount) ||
    (result.actionableCount as number) < 0 ||
    !Array.isArray(result.items) ||
    result.items.length > MEMBER_NOTIFICATION_LIST_LIMIT ||
    !result.items.every(isNotificationItem) ||
    result.overflowHref !== MEMBER_NOTIFICATIONS_OVERFLOW_HREF ||
    typeof result.hasMore !== 'boolean'
  ) return null

  return {
    status: 'available',
    actionableCount: result.actionableCount as number,
    items: result.items,
    overflowHref: MEMBER_NOTIFICATIONS_OVERFLOW_HREF,
    hasMore: result.hasMore,
  }
}

function BellIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.85 23.85 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}

function formatStartsAt(value: string) {
  return notificationDateFormatter.format(new Date(value))
}

export function MemberNotificationsControl({
  tone = 'light',
  open: controlledOpen,
  onOpenChange,
}: MemberNotificationsControlProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const [state, setState] = useState<NotificationState>({ status: 'loading' })
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const requestSequenceRef = useRef(0)
  const lastRequestedAtRef = useRef(0)
  const lastLoadedAtRef = useRef(0)
  const retryAfterRef = useRef(0)
  const inFlightRefreshRef = useRef<Promise<void> | null>(null)
  const requestAbortRef = useRef<AbortController | null>(null)
  const refreshAfterFlightRef = useRef(false)
  const refreshAfterCooldownRef = useRef(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const panelId = `member-notifications-${useId().replace(/:/gu, '')}`
  const query = searchParams.toString()
  const currentPath = `${pathname || '/'}${query ? `?${query}` : ''}`
  const previousPathRef = useRef(currentPath)
  const returnTo = encodeURIComponent(currentPath)

  const setDisclosureOpen = useCallback((nextOpen: boolean, restoreFocus = false) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
    if (!nextOpen && restoreFocus) triggerRef.current?.focus()
  }, [controlledOpen, onOpenChange])

  const refresh = useCallback((force = false): Promise<void> => {
    if (inFlightRefreshRef.current) {
      if (force) refreshAfterFlightRef.current = true
      return inFlightRefreshRef.current
    }
    const now = Date.now()
    if (now < retryAfterRef.current) {
      if (force) refreshAfterCooldownRef.current = true
      return Promise.resolve()
    }
    if (!force && now - lastRequestedAtRef.current < BACKGROUND_REFRESH_DEDUP_MS) return Promise.resolve()
    lastRequestedAtRef.current = now
    const sequence = ++requestSequenceRef.current
    const controller = new AbortController()
    requestAbortRef.current = controller
    setState({ status: 'loading' })

    function applyRetryCooldown(response?: Response) {
      const suppliedSeconds = Number(response?.headers.get('Retry-After'))
      const seconds = Number.isFinite(suppliedSeconds) && suppliedSeconds > 0
        ? Math.min(suppliedSeconds, MAX_RETRY_AFTER_SECONDS)
        : DEFAULT_RETRY_AFTER_SECONDS
      retryAfterRef.current = Date.now() + seconds * 1000
      setCooldownUntil(retryAfterRef.current)
    }

    let request!: Promise<void>
    request = (async () => {
      try {
        const response = await fetch('/api/member-notifications', {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (sequence !== requestSequenceRef.current) return
        if (response.status === 429 || response.status >= 500) {
          applyRetryCooldown(response)
        } else {
          retryAfterRef.current = 0
          setCooldownUntil(0)
        }
        const parsed = parseNotificationState(await response.json())
        if (sequence !== requestSequenceRef.current) return

        if (!parsed || (response.status === 401 && parsed.status !== 'auth-required')) {
          setState({ status: 'unavailable' })
        } else {
          setState(parsed)
        }
        lastLoadedAtRef.current = Date.now()
      } catch {
        if (sequence !== requestSequenceRef.current) return
        applyRetryCooldown()
        setState({ status: 'unavailable' })
        lastLoadedAtRef.current = Date.now()
      } finally {
        if (requestAbortRef.current === controller) requestAbortRef.current = null
        if (inFlightRefreshRef.current === request) inFlightRefreshRef.current = null
        if (sequence === requestSequenceRef.current && refreshAfterFlightRef.current) {
          refreshAfterFlightRef.current = false
          void refresh(true)
        }
      }
    })()
    inFlightRefreshRef.current = request
    return request
  }, [])

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const timeout = window.setTimeout(() => {
      setCooldownUntil(0)
      if (refreshAfterCooldownRef.current) {
        refreshAfterCooldownRef.current = false
        void refresh(true)
      }
    }, cooldownUntil - Date.now())
    return () => window.clearTimeout(timeout)
  }, [cooldownUntil, refresh])

  useEffect(() => {
    void refresh()
    return () => {
      refreshAfterFlightRef.current = false
      refreshAfterCooldownRef.current = false
      requestSequenceRef.current += 1
      lastRequestedAtRef.current = 0
      requestAbortRef.current?.abort()
      requestAbortRef.current = null
      inFlightRefreshRef.current = null
    }
  }, [refresh])

  useEffect(() => {
    function refreshAfterMemberAction() {
      void refresh(true)
    }
    window.addEventListener(MEMBER_NOTIFICATIONS_REFRESH_EVENT, refreshAfterMemberAction)
    return () => window.removeEventListener(MEMBER_NOTIFICATIONS_REFRESH_EVENT, refreshAfterMemberAction)
  }, [refresh])

  useEffect(() => {
    if (currentPath === previousPathRef.current) return
    previousPathRef.current = currentPath
    setDisclosureOpen(false)
    if (lastLoadedAtRef.current > 0 && Date.now() - lastLoadedAtRef.current >= MAX_AGE_MS) {
      void refresh()
    }
  }, [currentPath, refresh, setDisclosureOpen])

  useEffect(() => {
    function refreshWhenActive() {
      if (document.visibilityState === 'visible') void refresh()
    }
    function refreshOnFocus() {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', refreshWhenActive)
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenActive)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDisclosureOpen(false, true)
      }
    }
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setDisclosureOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open, setDisclosureOpen])

  const count = state.status === 'available' ? state.actionableCount : null
  const triggerLabel = count === null
    ? 'Notifications'
    : count === 1
      ? 'Notifications, 1 action requiring attention'
      : `Notifications, ${count} actions requiring attention`
  const triggerTone = tone === 'dark'
    ? 'text-brand-black hover:bg-warm-white'
    : 'text-white hover:bg-white/10'

  function toggle() {
    const nextOpen = !open
    setDisclosureOpen(nextOpen)
    if (nextOpen) void refresh(true)
  }

  return (
    <div ref={rootRef} className="relative" data-member-notifications>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={`relative flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors ${triggerTone}`}
      >
        <BellIcon />
        {count !== null && count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rich-red px-1 text-[0.625rem] font-bold leading-4 text-white" aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <section
          id={panelId}
          aria-label="Notifications"
          className="fixed inset-x-3 top-20 z-[70] mt-2 w-auto overflow-hidden rounded-lg border border-warm-grey/60 bg-white text-brand-black shadow-xl shadow-brand-black/10 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-[min(22rem,calc(100vw-1.5rem))]"
        >
          <div className="border-b border-warm-grey/40 px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <p className="text-xs text-mid-grey">Actions that need your attention</p>
          </div>
          <div className="max-h-[min(26rem,calc(100vh-8rem))] overflow-y-auto overscroll-contain">
            <div aria-live="polite" role="status">
              {state.status === 'loading' && <p className="px-4 py-5 text-sm text-mid-grey">Loading notifications…</p>}
              {state.status === 'auth-required' && (
                <div className="px-4 py-4">
                  <p className="text-sm text-dark-grey">Sign in again to see your notifications.</p>
                  <a href={`/auth/login?returnTo=${returnTo}`} rel="nofollow" className="mt-3 flex min-h-11 items-center text-sm font-semibold text-rich-red">Sign in</a>
                </div>
              )}
              {state.status === 'unavailable' && (
                <div className="px-4 py-4">
                  <p className="text-sm text-dark-grey">Notifications are unavailable right now.</p>
                  <button
                    type="button"
                    disabled={cooldownUntil > Date.now()}
                    onClick={() => void refresh(true)}
                    className="mt-3 min-h-11 text-sm font-semibold text-rich-red disabled:text-mid-grey"
                  >
                    {cooldownUntil > Date.now() ? 'Try again shortly' : 'Retry'}
                  </button>
                </div>
              )}
              {state.status === 'available' && state.items.length === 0 && (
                <p className="px-4 py-5 text-sm text-mid-grey">Nothing needs your attention right now.</p>
              )}
            </div>
            {state.status === 'available' && state.items.length > 0 && (
              <ul className="divide-y divide-warm-grey/40">
                {state.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      rel="nofollow"
                      onClick={() => {
                        setDisclosureOpen(false)
                        window.setTimeout(() => {
                          try {
                            const targetId = decodeURIComponent(new URL(item.href, window.location.origin).hash.slice(1))
                            if (targetId.startsWith('rock-schedule:')) document.getElementById(targetId)?.focus()
                          } catch {
                            // The transport contract already rejects malformed destinations.
                          }
                        }, 0)
                      }}
                      className="block min-h-11 px-4 py-3 transition-colors hover:bg-warm-white"
                    >
                      <span className="block break-words text-sm font-semibold text-brand-black">{item.title}</span>
                      <span className="mt-0.5 block break-words text-xs text-mid-grey">{item.summary}</span>
                      <time dateTime={item.startsAt} className="mt-1 block text-xs font-medium text-dark-grey">{formatStartsAt(item.startsAt)}</time>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {state.status === 'available' && (state.items.length > 0 || state.hasMore) && (
            <a href={state.overflowHref} rel="nofollow" className="flex min-h-11 items-center justify-center border-t border-warm-grey/40 px-4 text-sm font-semibold text-rich-red">
              View My Service
            </a>
          )}
        </section>
      )}
    </div>
  )
}
