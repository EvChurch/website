import { afterEach, expect, it, vi } from 'vitest'
import Page, { generateMetadata } from './page'
import { CampaignContent } from '@/components/giving/CampaignContent'
const cms = vi.hoisted(() => ({ page: vi.fn((_input: { params: Promise<{ slug: string }> }) => 'existing-cms-page'), metadata: vi.fn(async () => ({ title: 'Existing campaign' })) }))
vi.mock('../[slug]/page', () => ({ default: cms.page, generateMetadata: cms.metadata }))
vi.mock('@/components/giving/GiveSundayCart', () => ({ GiveSundayCart: () => null }))
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
it('renders the campaign overview on the actual route; giving opens separately in the launcher', async () => {
  vi.stubEnv('GIVING_CART_PREVIEW_ENABLED','true')
  const element = Page()
  expect(typeof element === 'object' && element !== null && 'props' in element && element.props.children[0].type).toBe(CampaignContent)
  expect(cms.page).not.toHaveBeenCalled()
  expect(await generateMetadata()).toMatchObject({ robots: { index: false, follow: false } })
})
it('preserves the existing CMS page in production even when the review flag is set', async () => {
  vi.stubEnv('GIVING_CART_PREVIEW_ENABLED','true')
  vi.stubEnv('NODE_ENV','production')
  expect(Page()).toBe('existing-cms-page')
  expect(await cms.page.mock.calls[0]?.[0]?.params).toEqual({ slug:'one-off-giving' })
  expect(await generateMetadata()).toEqual({ title:'Existing campaign' })
})
