import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadLauncherData: vi.fn().mockResolvedValue({
    available: false,
    campuses: [],
    items: [],
  }),
  loadSiteFeedbackSettings: vi.fn().mockResolvedValue(null),
  publicChrome: vi.fn(({ children }: { children: React.ReactNode }) => children),
}))

vi.mock('next/font/google', () => ({
  Albert_Sans: () => ({ variable: 'font-albert-sans' }),
  Source_Serif_4: () => ({ variable: 'font-source-serif' }),
}))
vi.mock('@/lib/launcher/service-guide', () => ({
  loadLauncherData: mocks.loadLauncherData,
}))
vi.mock('@/lib/site-feedback/settings', () => ({
  loadSiteFeedbackSettings: mocks.loadSiteFeedbackSettings,
}))
vi.mock('@/components/layout/PublicChrome', () => ({
  PublicChrome: mocks.publicChrome,
}))
vi.mock('@/components/layout/AnnouncementBanner', () => ({
  AnnouncementBanner: () => null,
}))
vi.mock('@/components/seo/OrganizationJsonLd', () => ({
  OrganizationJsonLd: () => null,
}))

import FrontendLayout from './layout'

describe('FrontendLayout public rendering boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadSiteFeedbackSettings.mockResolvedValue(null)
  })

  it('does not import request headers, session readers, or admin authentication', () => {
    const source = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8')

    expect(source).not.toContain("from 'next/headers'")
    expect(source).not.toContain('@/auth/member-session')
    expect(source).not.toContain('@/auth/member-impersonation')
    expect(source).not.toContain('@/auth/payload-admin-session')
    expect(source).not.toContain("export const dynamic = 'force-dynamic'")
  })

  it('renders public data through the client chrome without visitor data', async () => {
    const launcher = {
      available: true,
      campuses: [{ slug: 'north', name: 'North' }],
      items: [],
    }
    const feedback = {
      bannerCopy: 'Help us improve the new ev.church.',
      ctaLabel: 'Share feedback.',
      modalTitle: 'Share your feedback',
      modalIntro: 'Tell us what is working well or what we could improve.',
      dismissalVersion: 'v2',
      turnstileSiteKey: 'site-key',
    }
    mocks.loadLauncherData.mockResolvedValue(launcher)
    mocks.loadSiteFeedbackSettings.mockResolvedValue(feedback)

    const markup = renderToStaticMarkup(
      await FrontendLayout({ children: <section>Public page</section> }),
    )

    expect(markup).toContain('Public page')
    expect(mocks.publicChrome).toHaveBeenCalledWith(
      {
        announcement: expect.anything(),
        children: expect.anything(),
        feedback,
        launcher,
      },
      undefined,
    )
    expect(JSON.stringify(mocks.publicChrome.mock.calls)).not.toContain('memberProfile')
    expect(JSON.stringify(mocks.publicChrome.mock.calls)).not.toContain('impersonation')
  })
})
