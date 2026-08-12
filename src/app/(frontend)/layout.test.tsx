import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  enabled: false,
  getCurrentMemberProfileState: vi.fn(),
  loadLauncherData: vi.fn().mockResolvedValue({
    available: false,
    campuses: [],
    items: [],
  }),
  loadSiteFeedbackSettings: vi.fn().mockResolvedValue(null),
  siteHeader: vi.fn((_props: {
    feedback: unknown
    memberProfile?: {
      name: string
      email: string
      avatarUrl: string | null
    } | null
  }) => null),
}))

vi.mock('@/auth/member-auth0-config', () => ({
  isMemberAuthEnabled: () => mocks.enabled,
}))
vi.mock('@/auth/member-session', () => ({
  getCurrentMemberProfileState: mocks.getCurrentMemberProfileState,
}))
vi.mock('@/lib/launcher/service-guide', () => ({
  loadLauncherData: mocks.loadLauncherData,
}))
vi.mock('@/lib/site-feedback/settings', () => ({
  loadSiteFeedbackSettings: mocks.loadSiteFeedbackSettings,
}))
vi.mock('@/components/launcher/NextStepsLauncher', () => ({
  NextStepsLauncher: () => null,
}))
vi.mock('@/components/layout/SiteHeader', () => ({ SiteHeader: mocks.siteHeader }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }))
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
    mocks.loadSiteFeedbackSettings.mockResolvedValue(null)
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
      { feedback, memberProfile: undefined },
      undefined,
    )
  })

  it('does not read a member session or show account controls when disabled', async () => {
    renderToStaticMarkup(await FrontendLayout({ children: <main>Page</main> }))

    expect(mocks.getCurrentMemberProfileState).not.toHaveBeenCalled()
    expect(mocks.siteHeader).toHaveBeenCalledWith(
      { feedback: null, memberProfile: undefined },
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
