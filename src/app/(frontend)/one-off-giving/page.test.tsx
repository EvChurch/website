import { afterEach, expect, it, vi } from 'vitest'
import Page, { generateMetadata } from './page'
import { CampaignContent } from '@/components/giving/CampaignContent'
const cms = vi.hoisted(() => ({ page: vi.fn((_input: { params: Promise<{ slug: string }> }) => 'existing-cms-page'), metadata: vi.fn(async () => ({ title: 'Existing campaign' })) }))
vi.mock('../[slug]/page', () => ({ default: cms.page, generateMetadata: cms.metadata }))
vi.mock('@/components/giving/GiveSundayCart', () => ({ CampaignStartButton: () => null }))
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
it('renders the campaign overview on the actual route; giving opens separately in the launcher', async () => {
  vi.stubEnv('GIVING_CAMPAIGN_ENABLED','true')
  const element = Page()
  expect(typeof element === 'object' && element !== null && 'props' in element && element.props.children[0].type).toBe(CampaignContent)
  expect(cms.page).not.toHaveBeenCalled()
  expect(await generateMetadata()).toEqual({ title:'Existing campaign' })
})
it('preserves the existing CMS page when the campaign deployment switch is off', async () => {
  vi.stubEnv('GIVING_CAMPAIGN_ENABLED','false')
  vi.stubEnv('NODE_ENV','production')
  expect(Page()).toBe('existing-cms-page')
  expect(await cms.page.mock.calls[0]?.[0]?.params).toEqual({ slug:'one-off-giving' })
  expect(await generateMetadata()).toEqual({ title:'Existing campaign' })
})
