'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import {
  MemberAccountControl,
  type MemberDisplayProfile,
} from './MemberAccountControl'

type NavItem = { label: string } & (
  | { href: string; children?: never }
  | { href?: string; children: { label: string; href: string }[] }
)

const navItems: NavItem[] = [
  {
    label: 'Visit',
    href: '/visit',
    children: [
      { label: 'What to Expect', href: '/visit' },
      { label: 'North Campus', href: '/campus/north' },
      { label: 'Central Campus', href: '/campus/central' },
      { label: 'Unichurch', href: '/campus/unichurch' },
    ],
  },
  {
    label: 'About',
    href: '/about',
    children: [
      { label: 'About Us', href: '/about' },
      { label: 'What We Believe', href: '/what-we-believe' },
      { label: 'Our Vision', href: '/vision' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    label: 'Next Steps',
    children: [
      { label: 'Explaining Christianity', href: '/explaining-christianity' },
      { label: 'Newish Connect', href: '/newish' },
      { label: 'Connect Groups', href: '/connect-groups' },
      { label: 'Kids', href: '/kids' },
      { label: 'Youth', href: '/youth' },
      { label: 'Good News', href: '/good-news' },
    ],
  },
  { label: 'Events', href: '/events' },
  { label: 'Sermons', href: '/sermons' },
]

/* ─────────────── Scroll Progress Bar ─────────────── */
function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed left-0 right-0 top-0 z-[60] h-[3px] bg-transparent">
      <div
        className="h-full bg-rich-red transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

/* ─────────────── Active Route Helper ─────────────── */
function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

function needsDarkHeaderAtTop(pathname: string): boolean {
  return pathname === '/privacy'
    || pathname === '/blog'
    || pathname.startsWith('/daily-readings/')
}

function isMemberPath(pathname: string) {
  return pathname === '/members' || pathname.startsWith('/members/')
}

/* ─────────────── Desktop Dropdown ─────────────── */
function DesktopDropdown({ item, darkTone, pathname }: { item: NavItem; darkTone: boolean; pathname: string }) {
  const [open, setOpen] = useState(false)
  const [canHover, setCanHover] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const active = item.children?.some((child) => isActive(pathname, child.href)) ?? false

  useEffect(() => {
    setCanHover(window.matchMedia('(hover: hover)').matches)
  }, [])

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpen(true)
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 120)
  }

  const classes = `group relative flex items-center gap-1.5 px-3 py-2 text-[0.8125rem] font-semibold uppercase tracking-wide transition-colors duration-200 ${
    active
      ? darkTone ? 'text-rich-red' : 'text-white'
      : darkTone ? 'text-brand-black/80 hover:text-rich-red' : 'text-white/90 hover:text-white'
  }`

  const underline = (
    <span
      data-header-underline
      className={`absolute bottom-0 left-3 right-3 h-[2px] origin-left rounded-full transition-transform duration-300 ease-out ${
        active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
      } ${darkTone ? 'bg-rich-red' : 'bg-white'}`}
    />
  )

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {canHover && item.href ? (
        <Link
          href={item.href}
          className={classes}
          data-active={active}
          data-header-nav-item
          aria-haspopup="true"
          aria-expanded={open}
        >
          {item.label}
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
          {underline}
        </Link>
      ) : (
        <button
          className={classes}
          data-active={active}
          data-header-nav-item
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen(!open)}
        >
          {item.label}
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
          {underline}
        </button>
      )}
      {open && (
        <div className="absolute left-1/2 top-full -translate-x-1/2 pt-2">
          <div className="animate-slide-down min-w-52 overflow-hidden rounded-lg border border-warm-grey/60 bg-white py-2 shadow-xl shadow-brand-black/5">
            {item.children!.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className="block px-5 py-2.5 text-sm text-dark-grey transition-all duration-150 hover:bg-warm-white hover:text-rich-red hover:pl-6"
                onClick={() => setOpen(false)}
              >
                {child.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────── Icons ─────────────── */
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

/* ─────────────── Mobile Menu ─────────────── */
function MobileMenu({
  open,
  onClose,
  memberProfile,
  adminHref,
}: {
  open: boolean
  onClose: () => void
  memberProfile?: MemberDisplayProfile | null
  adminHref?: string
}) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  return (
    <div
      className={`fixed inset-0 top-0 z-[55] lg:hidden transition-visibility duration-300 ${
        open ? 'visible' : 'invisible'
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-brand-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Close button area, same height as header */}
        <div className="flex h-20 items-center justify-end px-6">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-brand-black transition-colors hover:bg-warm-white"
            onClick={onClose}
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="px-6 pb-8">
          {navItems.map((item, i) => (
            <div
              key={item.label}
              className="border-b border-cool-grey/60"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {item.children ? (
                <>
                  <button
                    className="flex w-full items-center justify-between py-5 text-[0.9375rem] font-semibold text-brand-black"
                    onClick={() =>
                      setExpandedItem(
                        expandedItem === item.label ? null : item.label,
                      )
                    }
                    aria-expanded={expandedItem === item.label}
                  >
                    {item.label}
                    <ChevronDown
                      className={`h-4 w-4 text-mid-grey transition-transform duration-200 ${
                        expandedItem === item.label ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ${
                      expandedItem === item.label
                        ? 'grid-rows-[1fr]'
                        : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-4 pl-4">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="block py-2.5 text-sm text-mid-grey transition-colors hover:text-rich-red"
                            onClick={onClose}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <Link
                  href={item.href}
                  className="block py-5 text-[0.9375rem] font-semibold text-brand-black transition-colors hover:text-rich-red"
                  onClick={onClose}
                  {...(item.href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {item.label}
                </Link>
              )}
            </div>
          ))}

          {(memberProfile !== undefined || adminHref) && (
            <div className="border-b border-cool-grey/60">
              <Suspense fallback={<span aria-hidden className="block h-[65px]" />}>
                <MemberAccountControl
                  profile={memberProfile ?? null}
                  variant="drawer"
                  active={open}
                  adminHref={adminHref}
                />
              </Suspense>
            </div>
          )}

          {/* Mobile CTAs */}
          <div className="mt-8 space-y-3">
            <Link
              href="/visit"
              className="block w-full rounded-md bg-rich-red py-3.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-deep-red"
              onClick={onClose}
            >
              Plan Your Visit
            </Link>
            <Link
              href="https://give.ev.church"
              className="block w-full rounded-md border border-rich-red py-3.5 text-center text-sm font-semibold text-rich-red transition-colors hover:bg-rich-red hover:text-white"
              onClick={onClose}
            >
              Give
            </Link>
          </div>
        </nav>
      </div>
    </div>
  )
}

/* ─────────────── Header ─────────────── */
export function Header({
  memberProfile,
  topOffset = 0,
  adminHref,
}: {
  memberProfile?: MemberDisplayProfile | null
  topOffset?: number
  adminHref?: string
}) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const hasScrolledRef = useRef(false)
  const darkTone = scrolled || needsDarkHeaderAtTop(pathname)
  const memberPath = isMemberPath(pathname)

  // Set correct initial state without transition
  useEffect(() => {
    if (window.scrollY > 50) {
      setScrolled(true)
      hasScrolledRef.current = true
    }
  }, [])

  useEffect(() => {
    let lastY = window.scrollY
    let accumulatedDelta = 0
    // Require 40px of consistent scroll in one direction before toggling
    const THRESHOLD = 40

    function onScroll() {
      const y = window.scrollY
      const delta = y - lastY
      lastY = y

      // Ignore scroll events until the user has actually scrolled
      if (!hasScrolledRef.current) {
        if (Math.abs(delta) < 2) return
        hasScrolledRef.current = true
      }

      setScrolled(y > 50)

      // Near top of page, always show
      if (y < 120) {
        setHidden(false)
        accumulatedDelta = 0
        return
      }

      // Accumulate delta in the current direction; reset if direction reverses
      if ((delta > 0 && accumulatedDelta < 0) || (delta < 0 && accumulatedDelta > 0)) {
        accumulatedDelta = 0
      }
      accumulatedDelta += delta

      if (accumulatedDelta > THRESHOLD) {
        setHidden(true)
        accumulatedDelta = 0
      } else if (accumulatedDelta < -THRESHOLD) {
        setHidden(false)
        accumulatedDelta = 0
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      <ScrollProgress />

      <header
        data-public-site-header
        className={`fixed left-0 right-0 z-50 transition-[transform,background-color,box-shadow,backdrop-filter] duration-300 ${
          scrolled
            ? 'bg-white/90 shadow-sm shadow-brand-black/5 backdrop-blur-[12px]'
            : memberPath
              ? 'bg-[radial-gradient(circle_at_85%_10%,rgba(226,42,48,0.22),transparent_34%),linear-gradient(135deg,#0f0004,#23080e)]'
              : 'bg-transparent'
        }`}
        style={{
          top: topOffset,
          transform: hidden && !mobileOpen
            ? `translateY(calc(-100% - ${topOffset}px))`
            : 'translateY(0)',
        }}
      >
        <div className="mx-auto flex h-20 max-w-[80rem] items-center justify-between px-5 lg:h-[100px] lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center"
            aria-label="Ev Church, return to home"
          >
            <Image
              src="/images/global/ev-church-logo.png"
              alt="Ev Church"
              width={44}
              height={44}
              className="transition-opacity group-hover:opacity-80"
              priority
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-1 lg:flex">
            <nav
              className="flex items-center gap-0.5"
              aria-label="Main navigation"
            >
              {navItems.map((item) => {
                if (item.children) {
                  return (
                    <DesktopDropdown key={item.label} item={item} darkTone={darkTone} pathname={pathname} />
                  )
                }

                const active = isActive(pathname, item.href)

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    data-active={active}
                    data-header-nav-item
                    className={`group relative px-3 py-2 text-[0.8125rem] font-semibold uppercase tracking-wide transition-colors duration-200 ${
                      active
                        ? darkTone ? 'text-rich-red' : 'text-white'
                        : darkTone ? 'text-brand-black/80 hover:text-rich-red' : 'text-white/90 hover:text-white'
                    }`}
                  >
                    {item.label}
                    {/* Animated underline */}
                    <span
                      data-header-underline
                      className={`absolute bottom-0 left-3 right-3 h-[2px] origin-left rounded-full transition-transform duration-300 ease-out ${
                        active
                          ? 'scale-x-100'
                          : 'scale-x-0 group-hover:scale-x-100'
                      } ${darkTone ? 'bg-rich-red' : 'bg-white'}`}
                    />
                  </Link>
                )
              })}
            </nav>
            <Link
              href="https://give.ev.church"
              data-header-give
              className={`ml-3 mr-2 rounded-full px-5 py-2 text-[0.8125rem] font-semibold uppercase tracking-wide transition-colors duration-200 ${
                darkTone
                  ? 'bg-rich-red text-white hover:bg-deep-red'
                  : 'bg-white text-brand-black hover:bg-white/90'
              }`}
            >
              Give
            </Link>
            {(memberProfile !== undefined || adminHref) && (
              <Suspense fallback={<span aria-hidden className="h-9 w-9" />}>
                <MemberAccountControl
                  profile={memberProfile ?? null}
                  variant="desktop"
                  tone={darkTone ? 'dark' : 'light'}
                  adminHref={adminHref}
                />
              </Suspense>
            )}
          </div>

          <div className="flex items-center gap-1 lg:hidden">
            {(memberProfile !== undefined || adminHref) && (
              <Suspense fallback={<span aria-hidden className="h-10 w-10" />}>
                <MemberAccountControl
                  profile={memberProfile ?? null}
                  variant="mobile-icon"
                  tone={darkTone ? 'dark' : 'light'}
                  active={!mobileOpen}
                  adminHref={adminHref}
                />
              </Suspense>
            )}

            {/* Mobile Hamburger */}
            <button
              data-header-menu
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                darkTone ? 'text-brand-black hover:bg-warm-white' : 'text-white hover:bg-white/10'
              }`}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        memberProfile={memberProfile}
        adminHref={adminHref}
      />
    </>
  )
}
