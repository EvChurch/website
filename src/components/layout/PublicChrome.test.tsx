// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  pathname: '/',
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}))
vi.mock('@/components/layout/SiteHeader', () => ({
  SiteHeader: ({ memberProfile, adminHref, impersonation }: {
    memberProfile: { name: string } | null
    adminHref?: string
    impersonation?: { name: string } | null
  }) => <div data-site-header>{memberProfile?.name ?? 'signed-out'}|{adminHref ?? ''}|{impersonation?.name ?? ''}</div>,
}))
vi.mock('@/components/layout/Header', () => ({ Header: () => <div data-basic-header /> }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => <div data-footer /> }))
vi.mock('@/components/layout/AnnouncementBanner', () => ({ AnnouncementBanner: () => null }))
vi.mock('@/components/seo/AnalyticsManager', () => ({ AnalyticsManager: ({ postHogIdentity }: { postHogIdentity?: { distinctId: string } | null }) => <div data-posthog-identity={postHogIdentity?.distinctId ?? (postHogIdentity === null ? 'anonymous' : 'pending')} /> }))
vi.mock('@/components/media/MediaPlayerProvider', () => ({ MediaPlayerProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/components/media/VideoContainer', () => ({ VideoContainer: () => null }))
vi.mock('@/components/audio/AudioPlayerBar', () => ({ AudioPlayerBar: () => null }))
vi.mock('@/components/audio/AudioPlayerSpacer', () => ({ AudioPlayerSpacer: () => null }))
vi.mock('@/components/giving/GivingExperienceProvider', () => ({
  GivingExperienceProvider: ({ children, serverEligibility }: { children: React.ReactNode; serverEligibility: string | null }) => (
    <div data-giving-eligibility={serverEligibility ?? 'disabled'}>{children}</div>
  ),
}))
vi.mock('@/components/giving/GivingFlow', () => ({
  GivingFlow: ({ synthetic }: { synthetic: boolean }) => <div data-giving-flow={synthetic ? 'synthetic' : 'real'} />,
}))
vi.mock('@/components/giving/GivingUnavailable', () => ({ GivingUnavailable: () => <div data-giving-unavailable /> }))
vi.mock('@/components/launcher/NextStepsLauncher', () => ({
  NextStepsLauncher: ({ memberCampusSlug, signedInEmail }: { memberCampusSlug?: string | null; signedInEmail?: string }) => (
    <div data-launcher>{memberCampusSlug ?? ''}|{signedInEmail ?? ''}</div>
  ),
}))

import { PublicChrome } from './PublicChrome'

const launcher = { available: false, campuses: [], items: [] }
const givingProps = {
  givingFunds: [],
  givingRuntime: null,
}

describe('PublicChrome', () => {
  beforeEach(() => {
    mocks.pathname = '/'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    delete document.documentElement.dataset.routeTransition
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('keeps anonymous HTML signed out and contains no private member data', () => {
    const markup = renderToStaticMarkup(
      <PublicChrome {...givingProps} launcher={launcher} feedback={null} announcement={null} footer={<div data-footer />}><p>Page</p></PublicChrome>,
    )

    expect(markup).toContain('signed-out')
    expect(markup).not.toContain('Aroha Ngata')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('hydrates signed-in display state from the private endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      memberProfile: { name: 'Aroha Ngata', email: 'aroha@example.com', avatarUrl: '/member-avatar' },
      memberCampusSlug: 'north',
      adminHref: '/admin/impersonate',
      impersonation: { personId: 42, name: 'Aroha Ngata', email: 'aroha@example.com' },
      givingResumeRequested: false,
      givingTurnstileSiteKey: 'turnstile-key',
      postHogIdentity: { distinctId: 'A'.repeat(43), name: 'Aroha Ngata', email: 'aroha@example.com' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <PublicChrome {...givingProps} launcher={launcher} feedback={null} announcement={null} footer={<div data-footer />}><p>Page</p></PublicChrome>,
    ))

    expect(fetch).toHaveBeenCalledWith('/api/member-chrome', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    expect(container.querySelector('[data-site-header]')?.textContent).toBe(
      'Aroha Ngata|/admin/impersonate|Aroha Ngata',
    )
    expect(container.querySelector('[data-launcher]')?.textContent).toBe(
      'north|aroha@example.com',
    )
    expect(container.querySelector('[data-posthog-identity]')?.getAttribute('data-posthog-identity')).toBe('A'.repeat(43))
    await act(async () => root.unmount())
  })

  it('uses minimal chrome and does not request member state for shared resources', async () => {
    mocks.pathname = `/shared/leader-resources/${'a'.repeat(32)}`
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <PublicChrome {...givingProps} launcher={launcher} feedback={null} announcement={null} footer={<div data-footer />}><p>Shared</p></PublicChrome>,
    ))

    expect(container.querySelector('[data-basic-header]')).not.toBeNull()
    expect(container.querySelector('[data-footer]')).not.toBeNull()
    expect(container.querySelector('[data-site-header]')).toBeNull()
    expect(container.querySelector('[data-launcher]')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })

  it('keeps first-load content static and enables animation after route changes', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      memberProfile: null,
      memberCampusSlug: null,
      adminHref: null,
      impersonation: null,
      givingResumeRequested: false,
      givingTurnstileSiteKey: 'turnstile-key',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <PublicChrome {...givingProps} launcher={launcher} feedback={null} announcement={null} footer={<div data-footer />}><p>Page</p></PublicChrome>,
    ))
    expect(document.documentElement.dataset.routeTransition).toBeUndefined()

    mocks.pathname = '/about'
    await act(async () => root.render(
      <PublicChrome {...givingProps} launcher={launcher} feedback={null} announcement={null} footer={<div data-footer />}><p>About</p></PublicChrome>,
    ))
    expect(document.documentElement.dataset.routeTransition).toBe('true')

    await act(async () => vi.advanceTimersByTime(1_250))
    expect(document.documentElement.dataset.routeTransition).toBeUndefined()

    await act(async () => root.unmount())
    vi.useRealTimers()
  })
})
