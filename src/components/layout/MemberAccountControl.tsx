'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useId,
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
}

function PersonIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0A17.9 17.9 0 0112 21.75a17.9 17.9 0 01-7.5-1.65z"
      />
    </svg>
  )
}

function initialsFor(name: string) {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('') || '?'
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
      // eslint-disable-next-line @next/next/no-img-element
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
      aria-hidden={!descriptive}
      aria-label={descriptive ? `${profile.name}'s profile` : undefined}
      className={`${sizeClasses} flex shrink-0 items-center justify-center rounded-full bg-rich-red font-semibold text-white`}
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
}: MemberAccountControlProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverId = `member-account-${useId().replace(/:/gu, '')}`
  const query = searchParams.toString()
  const currentPath = `${pathname || '/'}${query ? `?${query}` : ''}`
  const returnTo = encodeURIComponent(currentPath)

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }, [])

  useEffect(() => {
    if (!active) close(false)
  }, [active, close])

  useEffect(() => {
    close(false)
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
    return (
      <a
        href={`/member-auth/login?returnTo=${returnTo}`}
        aria-label="Sign in"
        className={isDrawer
          ? 'flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-brand-black transition-colors hover:bg-warm-white'
          : `flex min-h-10 min-w-10 items-center justify-center rounded-full transition-colors ${iconTone}`}
      >
        <PersonIcon />
        {isDrawer && <span>Sign in</span>}
      </a>
    )
  }

  return (
    <div ref={rootRef} className={`relative ${isDrawer ? 'w-full' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Open account for ${profile.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((current) => !current)}
        className={isDrawer
          ? 'flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-warm-white'
          : `flex min-h-10 min-w-10 items-center justify-center rounded-full transition-colors ${iconTone}`}
      >
        <MemberAvatar profile={profile} size="small" />
        {isDrawer && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-brand-black">
              {profile.name}
            </span>
            <span className="block truncate text-xs text-mid-grey">Account</span>
          </span>
        )}
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Account details"
          className={`absolute z-[70] w-72 rounded-lg border border-warm-grey/60 bg-white p-5 text-brand-black shadow-xl shadow-brand-black/10 ${
            isDrawer ? 'left-0 top-full mt-2' : 'right-0 top-full mt-3'
          }`}
        >
          <div className="flex items-center gap-3">
            <MemberAvatar profile={profile} size="large" descriptive />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile.name}</p>
              <p className="truncate text-sm text-mid-grey">{profile.email}</p>
            </div>
          </div>
          <a
            href={`/member-auth/logout?returnTo=${returnTo}`}
            className="mt-5 flex min-h-10 w-full items-center justify-center rounded-md border border-rich-red px-4 py-2 text-sm font-semibold text-rich-red transition-colors hover:bg-rich-red hover:text-white"
          >
            Log out
          </a>
        </div>
      )}
    </div>
  )
}
