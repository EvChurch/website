import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CampaignContent } from './CampaignContent'
import presentation from '@/lib/giving/campaign-presentation.json'
vi.mock('./GiveSundayCart',()=>({usePendingGiftAmount:()=>0,CampaignStartButton:()=><button>Choose Your Gifts</button>}))

describe('existing campaign presentation',()=>{
  it('preserves the dark heading, centered verse, copy and photographs in six cards, three per desktop row',()=>{
    const html=renderToStaticMarkup(<CampaignContent />)
    expect(html).toContain('Treasure what lasts forever.')
    expect(html).toContain('bg-brand-black lg:pb-20')
    expect(html).toContain('font-serif text-h2')
    expect(html).toContain(presentation.header.description)
    expect(html).toContain('sm:grid-cols-2 lg:grid-cols-3')
    expect(html.match(/data-campaign-card=/g)).toHaveLength(6)
    expect(html.match(/role="progressbar"/g)).toHaveLength(4)
    for(const item of presentation.opportunities){
      expect(html).toContain(item.image.alt.replaceAll('&','&amp;').replaceAll('"','&quot;'))
      expect(html).toContain(item.description.replaceAll("'",'&#x27;'))
    }
  })
  it('puts Cambodia last and offers guided giving in the header, beneath the introduction and beneath the opportunities',()=>{
    const html=renderToStaticMarkup(<CampaignContent />)
    expect([...html.matchAll(/data-campaign-card="([^"]+)"/g)].map(match=>match[1])).toEqual(['plant','train','grow','build','greatest-need','cambodia'])
    expect(html.match(/<button/g)).toHaveLength(3)
    expect(html.split('</section>')[0]).toContain('Choose Your Gifts')
    expect(html.slice(html.indexOf('id="campaign-options"'), html.indexOf('aria-label="Giving opportunities"'))).toContain('Choose Your Gifts')
    expect(html).not.toContain('Add Gift')
    expect(html).not.toContain('Sponsor with Tearfund')
    expect(html).not.toContain('Child-Consignment')
    expect(html).not.toContain('After giving,')
    expect(html).not.toContain(' pending')
  })
})
