import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  enabled: false,
  getCurrentMemberProfileState: vi.fn(),
  getCurrentMemberImpersonation: vi.fn().mockResolvedValue(null),
  isCurrentPayloadAdmin: vi.fn().mockResolvedValue(false),
  loadLauncherData: vi.fn().mockResolvedValue({
    available: false,
    campuses: [],
    items: [],
  }),
  loadSiteFeedbackSettings: vi.fn().mockResolvedValue(null),
  sharedResource: false,
  givingIdentity: { signedIn: false } as { signedIn: boolean; firstName?: string | null; lastName?: string | null; email?: string | null },
  rejectGivingIdentity: false,
  resolveGivingIdentity: vi.fn(),
  header: vi.fn(() => null),
  footer: vi.fn(() => null),
  siteHeader: vi.fn((_props: {
    feedback: unknown
    memberProfile?: {
      name: string
      email: string
      avatarUrl: string | null
    } | null
  }) => null),
  launcher: vi.fn((_props: {
    feedback: unknown
    signedInEmail?: string
  }) => null),
  givingProvider: vi.fn((props: {
    children: React.ReactNode
    serverEligibility: string | null
    givingExperience?: React.ReactElement | null
  }) => <div data-giving-eligibility={props.serverEligibility ?? 'disabled'}>{props.children}</div>),
  getCachedActiveGivingFunds: vi.fn().mockResolvedValue([
    { id: 1, name: 'General', code: 'GENERAL', sortOrder: 0, isDefault: true },
  ]),
  givingFlow: vi.fn(() => null),
  givingUnavailable: vi.fn(() => null),
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers(mocks.sharedResource ? { 'x-ev-shared-resource': '1' } : undefined),
  cookies: async () => ({ get: () => undefined }),
}))
vi.mock('next/font/google', () => ({
  Albert_Sans: () => ({ variable: 'font-albert-sans' }),
  Source_Serif_4: () => ({ variable: 'font-source-serif' }),
}))

vi.mock('@/auth/member-auth0-config', () => ({
  isMemberAuthEnabled: () => mocks.enabled,
}))
vi.mock('@/auth/member-session', () => ({
  getCurrentMemberProfileState: mocks.getCurrentMemberProfileState,
}))
vi.mock('@/auth/giving-member-identity', () => ({
  resolveCurrentGivingMemberIdentity: mocks.resolveGivingIdentity.mockImplementation(async () => {
    if (mocks.rejectGivingIdentity) throw new Error('Rock unavailable')
    return mocks.givingIdentity
  }),
}))
vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({
    getSession: async () => mocks.givingIdentity.signedIn ? { user: { sub: 'auth0|member' } } : null,
  }),
}))
vi.mock('@/lib/giving/rock-client', () => ({ createGivingRockClient: () => ({}) }))
vi.mock('@/auth/member-impersonation', () => ({
  getCurrentMemberImpersonation: mocks.getCurrentMemberImpersonation,
}))
vi.mock('@/auth/payload-admin-session', () => ({
  isCurrentPayloadAdmin: mocks.isCurrentPayloadAdmin,
}))
vi.mock('@/lib/launcher/service-guide', () => ({
  loadLauncherData: mocks.loadLauncherData,
}))
vi.mock('@/lib/site-feedback/settings', () => ({
  loadSiteFeedbackSettings: mocks.loadSiteFeedbackSettings,
}))
vi.mock('@/components/launcher/NextStepsLauncher', () => ({
  NextStepsLauncher: mocks.launcher,
}))
vi.mock('@/components/giving/GivingExperienceProvider', () => ({
  GivingExperienceProvider: mocks.givingProvider,
}))
vi.mock('@/components/giving/GivingFlow', () => ({ GivingFlow: mocks.givingFlow }))
vi.mock('@/components/giving/GivingUnavailable', () => ({ GivingUnavailable: mocks.givingUnavailable }))
vi.mock('@/lib/giving/funds', () => ({
  getCachedActiveGivingFunds: mocks.getCachedActiveGivingFunds,
}))
vi.mock('@/lib/giving/availability',()=>({resolveGivingRuntimeConfiguration:({protectedE2E=false}:{protectedE2E?:boolean}={})=>protectedE2E?{eligibility:'protected-e2e',gatewayOrigins:['https://sandbox.debit.blinkpay.co.nz'],synthetic:true}:process.env.BLINKPAY_PRODUCTION_ENABLED==='true'?{eligibility:'production',gatewayOrigins:['https://merchant-gateway.example.nz'],synthetic:false}:null}))
vi.mock('@/components/layout/SiteHeader', () => ({ SiteHeader: mocks.siteHeader }))
vi.mock('@/components/layout/Header', () => ({ Header: mocks.header }))
vi.mock('@/components/layout/Footer', () => ({ Footer: mocks.footer }))
vi.mock('@/components/layout/AnnouncementBanner', () => ({
  AnnouncementBanner: () => null,
}))
vi.mock('@/components/seo/OrganizationJsonLd', () => ({
  OrganizationJsonLd: () => null,
}))
vi.mock('@/components/seo/AnalyticsManager', () => ({
  AnalyticsManager: () => null,
}))
vi.mock('@/components/media/MediaPlayerProvider', () => ({
  MediaPlayerProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/media/VideoContainer', () => ({ VideoContainer: () => null }))
vi.mock('@/components/audio/AudioPlayerBar', () => ({ AudioPlayerBar: () => null }))
vi.mock('@/components/audio/AudioPlayerSpacer', () => ({ AudioPlayerSpacer: () => null }))

import FrontendLayout from './layout'

describe('FrontendLayout member account state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enabled = false
    mocks.sharedResource = false
    mocks.givingIdentity = { signedIn: false }
    mocks.rejectGivingIdentity = false
    mocks.loadSiteFeedbackSettings.mockResolvedValue(null)
  })

  it('defers fresh giving identity resolution while preserving signed-in eligibility', async () => {
    vi.stubEnv('BLINKPAY_PRODUCTION_ENABLED', 'true')
    mocks.enabled = true
    mocks.getCurrentMemberProfileState.mockResolvedValue({
      profile: { personId: 42, name: 'Do Not Split This', email: 'stale@example.com', photoUrl: null, campusSlug: null },
      needsRefresh: false,
    })
    renderToStaticMarkup(await FrontendLayout({ children: <main>Page</main> }))
    const providerProps = mocks.givingProvider.mock.calls.at(-1)?.[0]
    expect(providerProps).toMatchObject({ serverEligibility: 'production' })
    const givingExperience = providerProps?.givingExperience as React.ReactElement<{ identity: unknown }>
    expect(givingExperience.props.identity).toEqual({ signedIn: true })
    expect(mocks.resolveGivingIdentity).not.toHaveBeenCalled()

    mocks.rejectGivingIdentity = true
    renderToStaticMarkup(await FrontendLayout({ children: <main>Page</main> }))
    expect(mocks.givingProvider.mock.calls.at(-1)?.[0]).toMatchObject({ serverEligibility: 'production' })
    expect(mocks.resolveGivingIdentity).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('keeps the normal header and footer around shared resources without loading visitor services', async () => {
    mocks.sharedResource = true

    const markup = renderToStaticMarkup(
      await FrontendLayout({ children: <section>Shared resource</section> }),
    )

    expect(markup).toContain('class="font-albert-sans font-source-serif"')
    expect(mocks.header).toHaveBeenCalledOnce()
    expect(mocks.footer).toHaveBeenCalledOnce()
    expect(mocks.siteHeader).not.toHaveBeenCalled()
    expect(mocks.loadSiteFeedbackSettings).not.toHaveBeenCalled()
    expect(mocks.loadLauncherData).not.toHaveBeenCalled()
    expect(mocks.getCurrentMemberProfileState).not.toHaveBeenCalled()
    expect(mocks.getCurrentMemberImpersonation).not.toHaveBeenCalled()
    expect(mocks.isCurrentPayloadAdmin).not.toHaveBeenCalled()
    expect(mocks.givingProvider).not.toHaveBeenCalled()
  })

  it('passes only the exact production release gate into the client provider', async () => {
    vi.stubEnv('BLINKPAY_PRODUCTION_ENABLED', 'TRUE')
    let markup = renderToStaticMarkup(
      await FrontendLayout({ children: <main>Page</main> }),
    )
    expect(markup).toContain('data-giving-eligibility="disabled"')
    expect(mocks.getCachedActiveGivingFunds).toHaveBeenCalledOnce()
    expect(mocks.givingProvider.mock.calls.at(-1)?.[0]?.givingExperience).toBeTruthy()

    vi.stubEnv('BLINKPAY_PRODUCTION_ENABLED', 'true')
    markup = renderToStaticMarkup(
      await FrontendLayout({ children: <main>Page</main> }),
    )
    expect(markup).toContain('data-giving-eligibility="production"')
    vi.unstubAllEnvs()
  })

  it('keeps the launcher giving entry available when no funds can be loaded', async () => {
    mocks.getCachedActiveGivingFunds.mockResolvedValueOnce([])

    renderToStaticMarkup(await FrontendLayout({ children: <main>Page</main> }))

    const givingExperience = mocks.givingProvider.mock.calls.at(-1)?.[0]?.givingExperience
    expect(givingExperience).toBeTruthy()
    expect(givingExperience?.type).toBe(mocks.givingUnavailable)
  })

  it('keeps public pages available when loading giving funds fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.getCachedActiveGivingFunds.mockRejectedValueOnce(new Error('database unavailable'))

    const layout = await FrontendLayout({ children: <main>Page</main> })
    expect(() => renderToStaticMarkup(layout)).not.toThrow()
    const givingExperience = mocks.givingProvider.mock.calls.at(-1)?.[0]?.givingExperience
    expect(givingExperience?.type).toBe(mocks.givingUnavailable)
    expect(error).toHaveBeenCalledWith('Giving funds are unavailable.')
    error.mockRestore()
  })

  it('loads visitor-facing feedback settings into the composed header', async () => {
    const feedback = {
      bannerCopy: 'Help us improve the new ev.church.',
      ctaLabel: 'Share feedback.',
      modalTitle: 'Share your feedback',
      modalIntro: 'Tell us what is working well or what we could improve.',
      dismissalVersion: 'v2',
      turnstileSiteKey: 'site-key',
    }
    mocks.loadSiteFeedbackSettings.mockResolvedValue(feedback)

    renderToStaticMarkup(await FrontendLayout({ children: <main>Page</main> }))

    expect(mocks.loadSiteFeedbackSettings).toHaveBeenCalledOnce()
    expect(mocks.siteHeader).toHaveBeenCalledWith(
      {
        adminHref: undefined,
        feedback,
        impersonation: null,
        memberProfile: undefined,
      },
      undefined,
    )
    expect(mocks.launcher).toHaveBeenCalledWith(
      expect.objectContaining({ feedback, signedInEmail: undefined }),
      undefined,
    )
  })

  it('does not read a member session or show account controls when disabled', async () => {
    renderToStaticMarkup(await FrontendLayout({ children: <main>Page</main> }))

    expect(mocks.getCurrentMemberProfileState).not.toHaveBeenCalled()
    expect(mocks.siteHeader).toHaveBeenCalledWith(
      {
        adminHref: undefined,
        feedback: null,
        impersonation: null,
        memberProfile: undefined,
      },
      undefined,
    )
    expect(mocks.launcher).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: null,
        signedInEmail: undefined,
      }),
      undefined,
    )
  })

  it('passes only display-safe member fields into the header', async () => {
    mocks.enabled = true
    mocks.getCurrentMemberProfileState.mockResolvedValue({
      needsRefresh: false,
      profile: {
        personId: 42,
        name: 'Aroha Ngata',
        email: 'aroha@example.com',
        photoUrl: '/GetImage.ashx?id=abc',
      },
    })

    renderToStaticMarkup(await FrontendLayout({ children: <main>Page</main> }))

    expect(mocks.siteHeader).toHaveBeenCalledWith(
      {
        feedback: null,
        adminHref: undefined,
        impersonation: null,
        memberProfile: {
          name: 'Aroha Ngata',
          email: 'aroha@example.com',
          avatarUrl: '/member-avatar',
        },
      },
      undefined,
    )
    const headerProps = mocks.siteHeader.mock.calls[0]?.[0]
    expect(headerProps).not.toHaveProperty('personId')
    expect(mocks.launcher).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: null,
        signedInEmail: 'aroha@example.com',
      }),
      undefined,
    )
  })

  it('requests the avatar route once to upgrade a legacy session', async () => {
    mocks.enabled = true
    mocks.getCurrentMemberProfileState.mockResolvedValue({
      needsRefresh: true,
      profile: {
        personId: 42,
        name: 'Aroha Ngata',
        email: 'aroha@example.com',
        photoUrl: null,
      },
    })

    renderToStaticMarkup(await FrontendLayout({ children: <main>Page</main> }))

    expect(mocks.siteHeader).toHaveBeenCalledWith(
      {
        feedback: null,
        adminHref: undefined,
        impersonation: null,
        memberProfile: {
          name: 'Aroha Ngata',
          email: 'aroha@example.com',
          avatarUrl: '/member-avatar',
        },
      },
      undefined,
    )
  })
})
