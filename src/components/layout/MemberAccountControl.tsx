'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

export interface MemberDisplayProfile {
  name: string
  email: string
  avatarUrl: string | null
}

type MemberAccountVariant = 'desktop' | 'mobile-icon' | 'drawer'
type MemberAccountTone = 'light' | 'dark'

interface MemberAccountControlProps {
  profile: MemberDisplayProfile | null
  variant: MemberAccountVariant
  tone?: MemberAccountTone
  active?: boolean
  adminHref?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function memberAccountMenuItems(adminHref?: string) {
  return [
    { label: 'Overview', href: '/members' },
    { label: 'My Service', href: '/members/my-service' },
    { label: 'Connect Group', href: '/members/connect-groups' },
    ...(adminHref ? [{ label: 'Admin', href: adminHref }] : []),
  ]
}

function PersonIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      data-member-sign-in-icon
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle cx="12" cy="12" r="10" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 9a3 3 0 11-6 0 3 3 0 016 0zM6.75 18.25a5.25 5.25 0 0110.5 0"
      />
    </svg>
  )
}

const avatarColourClasses = [
  'bg-deep-red',
  'bg-ev-blue',
  'bg-ev-purple',
  'bg-newish-green',
  'bg-connect-brown',
  'bg-dark-brown',
  'bg-ec-blue',
  'bg-light-red-2',
] as const

function initialsFor(name: string) {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('') || '?'
}

function avatarColourFor(profile: MemberDisplayProfile) {
  const seed = `${profile.name.trim().toLowerCase()}|${profile.email.trim().toLowerCase()}`
  let hash = 0

  for (const character of seed) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0
  }

  return avatarColourClasses[hash % avatarColourClasses.length] ?? 'bg-deep-red'
}

function ChevronDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function MemberAvatar({
  profile,
  size,
  descriptive,
}: {
  profile: MemberDisplayProfile
  size: 'small' | 'large'
  descriptive?: boolean
}) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => setImageFailed(false), [profile.avatarUrl])

  const sizeClasses = size === 'large' ? 'h-14 w-14 text-base' : 'h-9 w-9 text-xs'

  if (profile.avatarUrl && !imageFailed) {
    return (
      // The source is the authenticated same-origin member-avatar route.
      <img
        src={profile.avatarUrl}
        alt={descriptive ? `${profile.name}'s profile` : ''}
        className={`${sizeClasses} shrink-0 rounded-full object-cover`}
        onError={() => setImageFailed(true)}
      />
    )
  }

  return (
    <span
      data-avatar-fallback
      aria-hidden={!descriptive}
      aria-label={descriptive ? `${profile.name}'s profile` : undefined}
      className={`${sizeClasses} ${avatarColourFor(profile)} flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
    >
      {initialsFor(profile.name)}
    </span>
  )
}

export function MemberAccountControl({
  profile,
  variant,
  tone = 'light',
  active = true,
  adminHref,
  open: controlledOpen,
  onOpenChange,
}: MemberAccountControlProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const [popoverMounted, setPopoverMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverId = `member-account-${useId().replace(/:/gu, '')}`
  const query = searchParams.toString()
  const currentPath = `${pathname || '/'}${query ? `?${query}` : ''}`
  const previousPathRef = useRef(currentPath)
  const returnTo = encodeURIComponent(currentPath)

  const setOpen = useCallback((nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [controlledOpen, onOpenChange])

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    setPopoverMounted(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }, [setOpen])

  const togglePopover = useCallback(() => {
    if (!active) return
    if (open) {
      close(false)
      return
    }

    setPopoverMounted(true)
    setOpen(true)
  }, [active, close, open])

  useEffect(() => {
    if (!active) close(false)
  }, [active, close])

  useEffect(() => {
    if (!open) setPopoverMounted(false)
  }, [open])

  useEffect(() => {
    if (currentPath !== previousPathRef.current) close(false)
    previousPathRef.current = currentPath
  }, [currentPath, close])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        close(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [close, open])

  const isDrawer = variant === 'drawer'
  const iconTone = tone === 'dark'
    ? 'text-brand-black hover:bg-warm-white'
    : 'text-white hover:bg-white/10'

  if (!profile) {
    if (adminHref) {
      return (
        <a
          href={adminHref}
          rel="nofollow"
          aria-label="Admin"
          data-header-account-control={!isDrawer ? true : undefined}
          className={isDrawer
            ? 'flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-brand-black transition-colors hover:bg-warm-white'
            : `flex min-h-10 min-w-10 items-center justify-center rounded-full transition-colors ${iconTone}`}
        >
          <PersonIcon />
          <span className={isDrawer ? '' : 'sr-only'}>Admin</span>
        </a>
      )
    }

    return (
      <a
        href={`/auth/login?returnTo=${returnTo}`}
        rel="nofollow"
        aria-label="Sign in"
        data-header-account-control={!isDrawer ? true : undefined}
        className={isDrawer
          ? 'flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-brand-black transition-colors hover:bg-warm-white'
          : `flex min-h-10 min-w-10 items-center justify-center rounded-full transition-colors ${iconTone}`}
      >
        <PersonIcon />
        {isDrawer && <span>Sign in</span>}
      </a>
    )
  }

  if (isDrawer) {
    return (
      <div ref={rootRef} className="w-full">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={togglePopover}
          className="flex w-full items-center justify-between gap-3 py-5 text-[0.9375rem] font-semibold text-brand-black transition-colors hover:text-rich-red"
        >
          <MemberAvatar profile={profile} size="small" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-semibold text-brand-black">
              {profile.name}
            </span>
            <span className="block truncate text-xs font-normal text-mid-grey">
              {profile.email}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-mid-grey transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div
          id={popoverId}
          data-state={open ? 'open' : 'closed'}
          aria-hidden={!open}
          inert={!open}
          className={`grid transition-[grid-template-rows] duration-300 ${
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <div className="pb-4 pl-4">
              {memberAccountMenuItems(adminHref).map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  rel="nofollow"
                  className="block py-2.5 text-sm text-mid-grey transition-colors hover:text-rich-red"
                >
                  {item.label}
                </a>
              ))}
              <div className="my-1 border-t border-warm-grey/30" />
              <a
                href={`/auth/logout?returnTo=${returnTo}`}
                rel="nofollow"
                className="block py-2.5 text-sm text-mid-grey transition-colors hover:text-rich-red"
              >
                Log out
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* Desktop/mobile-icon: hover menu */
  return (
    <MemberAccountHoverMenu
      profile={profile}
      tone={tone}
      active={active}
      pathname={pathname}
      searchParams={searchParams}
      open={open}
      onOpenChange={setOpen}
      popoverMounted={popoverMounted}
      setPopoverMounted={setPopoverMounted}
      rootRef={rootRef}
      triggerRef={triggerRef}
      popoverId={popoverId}
      adminHref={adminHref}
    />
  )
}

/* ─────────────── Hover-triggered menu ─────────────── */

function MemberAccountHoverMenu({
  profile,
  tone,
  active,
  pathname,
  searchParams,
  open,
  onOpenChange,
  popoverMounted,
  setPopoverMounted,
  rootRef,
  triggerRef,
  popoverId,
  adminHref,
}: {
  profile: MemberDisplayProfile
  tone: MemberAccountTone
  active: boolean
  pathname: string | null
  searchParams: URLSearchParams
  open: boolean
  onOpenChange: (open: boolean) => void
  popoverMounted: boolean
  setPopoverMounted: (mounted: boolean) => void
  rootRef: React.RefObject<HTMLDivElement | null>
  triggerRef: React.RefObject<HTMLButtonElement | null>
  popoverId: string
  adminHref?: string
}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const isHoveringRef = useRef(false)
  const query = searchParams.toString()
  const currentPath = `${pathname || '/'}${query ? `?${query}` : ''}`
  const prevPathRef = useRef(currentPath)

  const triggerTone = tone === 'dark'
    ? 'text-brand-black hover:bg-warm-white'
    : 'text-white hover:bg-white/10'

  // Menu items
  const menuItems = useMemo(
    () => memberAccountMenuItems(adminHref),
    [adminHref],
  )

  const clearCloseTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const closePopover = useCallback(() => {
    clearCloseTimer()
    onOpenChange(false)
    const el = document.getElementById(popoverId)
    if (el) {
      el.dataset.state = 'closed'
      el.setAttribute('aria-hidden', 'true')
      el.inert = true
      el.classList.add('pointer-events-none')
    }
    setPopoverMounted(false)
  }, [clearCloseTimer, onOpenChange, popoverId, setPopoverMounted])

  // Open on mouse enter
  function handleMouseEnter() {
    if (!active) return
    clearCloseTimer()
    isHoveringRef.current = true
    setPopoverMounted(true)
    onOpenChange(true)
  }

  // Close on mouse leave with delay
  function handleMouseLeave() {
    if (!active) return

    isHoveringRef.current = false
    clearCloseTimer()
    timeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current) {
        closePopover()
      }
    }, 120)
  }

  // Click fallback for non-hover devices
  function togglePopover() {
    if (!active) return
    if (open) {
      closePopover()
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    } else {
      setPopoverMounted(true)
      onOpenChange(true)
    }
  }

  useEffect(() => {
    if (!active) closePopover()
  }, [active, closePopover])

  useEffect(() => clearCloseTimer, [clearCloseTimer])

  // Close on route change — sync, no setTimeout
  useEffect(() => {
    if (open && currentPath !== prevPathRef.current) {
      closePopover()
    }
    prevPathRef.current = currentPath
  }, [closePopover, currentPath, open])

  // Escape key and outside pointer close
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePopover()
        triggerRef.current?.focus()
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        closePopover()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [closePopover, open, rootRef, triggerRef])

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        data-header-account-control
        aria-label={`Open account for ${profile.name}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={togglePopover}
        className={`flex min-h-10 min-w-10 items-center justify-center rounded-full transition-colors ${triggerTone}`}
      >
        <MemberAvatar profile={profile} size="small" />
      </button>

      {popoverMounted && (
        <div
          id={popoverId}
          role="menu"
          aria-label="Account menu"
          aria-hidden={!open}
          data-state={open ? 'open' : 'closed'}
          className="member-account-popover absolute right-0 top-full mt-2 z-[70] w-56 rounded-lg border border-warm-grey/60 bg-white py-1 text-brand-black shadow-xl shadow-brand-black/10"
        >
          {/* Member header */}
          <div className="flex items-center gap-3 border-b border-warm-grey/40 px-4 py-3">
            <MemberAvatar profile={profile} size="small" descriptive />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-black">
                {profile.name}
              </p>
              <p className="truncate text-xs text-mid-grey">{profile.email}</p>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                rel="nofollow"
                role="menuitem"
                className="block px-4 py-2.5 text-sm text-dark-grey transition-all duration-150 hover:bg-warm-white hover:text-rich-red hover:pl-5"
              >
                {item.label}
              </a>
            ))}
            <div className="my-1 border-t border-warm-grey/30" />
            <a
              href="/auth/logout"
              rel="nofollow"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-rich-red transition-all duration-150 hover:bg-rich-red/10 hover:pl-5"
            >
              Log out
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
