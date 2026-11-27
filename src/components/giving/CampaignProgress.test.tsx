import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CampaignProgress, CampaignProgressDisplay } from './CampaignProgress'
import { CAMPAIGN_PROGRESS, campaignProgress, campaignProgressFromReceipts } from '@/lib/giving/campaign-progress'

describe('confirmed campaign progress', () => {
  it('keeps confirmed giving black and shows the cart addition separately in red', () => {
    const values = { unit: 'money' as const, goal: 100_000, given: 25_000 }
    const pending = renderToStaticMarkup(<CampaignProgressDisplay title="Plant" values={values} pending={50_000} />)
    expect(pending).toContain('class="text-brand-black">$250</span>')
    expect(pending).toContain('gap-x-0.5 text-rich-red" aria-label="$500 pending"><span aria-hidden="true">+</span><span>$500</span>')
    expect(pending).toContain('Given so far')
    expect(pending).toContain('aria-valuenow="75"')
    expect(pending).toContain('plus $500 from your pending gift')
    const removed = renderToStaticMarkup(<CampaignProgressDisplay title="Plant" values={values} />)
    expect(removed).toContain('$250')
    expect(removed).toContain('class="text-brand-black">$250</span>')
    expect(removed).not.toContain('+$500')
    expect(values.given).toBe(25_000)
  })
  it('labels a draft contribution as pending when received totals are unknown', () => {
    const html = renderToStaticMarkup(<CampaignProgressDisplay title="Build" values={CAMPAIGN_PROGRESS.build} pending={50_000} />)
    expect(html).toContain('$500')
    expect(html).toContain('aria-label="$500 pending"')
    expect(html).toContain('Given so far')
    expect(html).toContain('Amount given not yet available')
    expect(CAMPAIGN_PROGRESS.build.given).toBeNull()
  })
  it('never applies pending money to child sponsorships', () => {
    const html = renderToStaticMarkup(<CampaignProgressDisplay title="Cambodia" values={CAMPAIGN_PROGRESS.cambodia} pending={50_000} />)
    expect(html).not.toContain('>Goal<')
    expect(html).not.toContain('$500')
    expect(html).not.toContain('pending gift')
  })
  it('keeps Greatest Need separate, with no goal or redistribution to other funds', () => {
    const progress = campaignProgressFromReceipts({ plant: 10_000, train: 20_000, grow: 30_000, build: 40_000, 'greatest-need': 50_000 })
    expect([progress.plant.given, progress.train.given, progress.grow.given, progress.build.given]).toEqual([10_000, 20_000, 30_000, 40_000])
    expect(progress['greatest-need']).toEqual({ unit: 'money', goal: null, given: 50_000 })
    const html = renderToStaticMarkup(<CampaignProgress title="Greatest Need" values={progress['greatest-need']} />)
    expect(html).toContain('$500')
    expect(html).not.toContain('>Goal<')
    expect(html).not.toContain('progressbar')
  })
  it('does not depend on other funds having known receipts', () => {
    const progress = campaignProgressFromReceipts({ plant: 100, train: null, grow: 0, build: 0, 'greatest-need': null })
    expect(progress.plant.given).toBe(100)
    expect(progress.train.given).toBeNull()
    expect(progress.grow.given).toBe(0)
    expect(progress['greatest-need'].given).toBeNull()
  })
  it('shows an amount given, a goal, and the corresponding percentage', () => {
    const html = renderToStaticMarkup(<CampaignProgress title="Build" values={{ unit:'money', goal:10000000, given:2500000 }} />)
    expect(html).toContain('$25,000')
    expect(html).toContain('$100,000')
    expect(html).toContain('aria-valuenow="25"')
    expect(html).toContain('width:25%')
  })
  it('caps the bar at its goal without hiding an above-goal total', () => {
    const html = renderToStaticMarkup(<CampaignProgress title="Build" values={{ unit:'money',goal:100000,given:125000 }} />)
    expect(html).toContain('$1,250')
    expect(html).toContain('width:100%')
    expect(html).toContain('aria-valuenow="100"')
  })
  it('displays the requested $0 placeholder without treating unknown receipts as confirmed zero', () => {
    const unknown = renderToStaticMarkup(<CampaignProgress title="Build" values={{ unit:'money',goal:100000,given:null }} />)
    expect(unknown).toContain('$0')
    expect(unknown).toContain('Amount given not yet available')
    expect(unknown).not.toContain('aria-valuenow=')
    const zero = renderToStaticMarkup(<CampaignProgress title="Build" values={{ unit:'money',goal:100000,given:0 }} />)
    expect(zero).toContain('$0')
    expect(zero).toContain('aria-valuenow="0"')
  })
  it('removes the Cambodia goal without inventing a sponsorship count or financial totals', () => {
    const html = renderToStaticMarkup(<CampaignProgress title="Cambodia" values={CAMPAIGN_PROGRESS.cambodia} />)
    expect(html).toContain('Sponsored')
    expect(html).not.toContain('>Goal<')
    expect(html).not.toContain('$')
    expect(html).not.toContain('aria-valuenow=')
    expect(CAMPAIGN_PROGRESS['greatest-need']).toEqual({ unit:'money',goal:null,given:null })
  })
  it.each([['plant', '$50,000'], ['train', '$100,000']] as const)('shows the updated %s goal supplied by Tatai', (id, goal) => {
    const html = renderToStaticMarkup(<CampaignProgress title={id} values={CAMPAIGN_PROGRESS[id]} />)
    expect(html).toContain(goal)
    expect(CAMPAIGN_PROGRESS[id].given).toBeNull()
  })
  it.each([['build', '$275,000'], ['grow', '$50,000']] as const)('shows the %s goal from the presentation without counting partner pledges as receipts', (id, goal) => {
    const html = renderToStaticMarkup(<CampaignProgress title={id} values={CAMPAIGN_PROGRESS[id]} />)
    expect(html).toContain(goal)
    expect(CAMPAIGN_PROGRESS[id].given).toBeNull()
    expect(html).toContain('Amount given not yet available')
    expect(html).not.toContain('aria-valuenow=')
    expect(html).not.toContain('$500,000')
  })
  it.each([
    { unit:'money' as const,goal:0,given:1 },
    { unit:'money' as const,goal:100,given:-1 },
    { unit:'money' as const,goal:Infinity,given:100 },
  ])('does not report a percentage for invalid figures', values => {
    expect(campaignProgress(values).percent).toBeNull()
  })
})
