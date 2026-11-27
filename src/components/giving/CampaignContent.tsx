import { PageHeaderBlockComponent } from '@/components/blocks/PageHeaderBlockComponent'
import { BlockquoteBlockComponent } from '@/components/blocks/BlockquoteBlockComponent'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { CTABlockComponent } from '@/components/blocks/CTABlockComponent'
import presentation from '@/lib/giving/campaign-presentation.json'
import { GIVE_SUNDAY_GIFTS } from '@/lib/giving/campaign'
import { CampaignStartButton } from './GiveSundayCart'
import { MediaImage } from '@/components/media/MediaImage'
import { FiHeart } from 'react-icons/fi'
import { CAMPAIGN_PROGRESS, type CampaignProgressKey } from '@/lib/giving/campaign-progress'
import { CampaignProgress } from './CampaignProgress'

// Keep the campaign overview informational; both calls to action open guided giving.
export function CampaignContent() {
  const greatestNeed = GIVE_SUNDAY_GIFTS.find(gift => gift.id === 'greatest-need')!
  const cambodia = presentation.opportunities.find(item => item.giftId === 'cambodia')!
  const opportunities = [
    ...presentation.opportunities.filter(item => item.giftId !== 'cambodia'),
    { giftId: greatestNeed.id, heading: greatestNeed.title, description: greatestNeed.description, image: null },
    cambodia,
  ]
  return <>
    <PageHeaderBlockComponent {...presentation.header} theme="dark" />
    <BlockquoteBlockComponent {...presentation.quote} style="centered" />
    <div id="campaign-options" className="scroll-mt-24 bg-white px-5 py-16 lg:px-8 lg:py-32">
      <ScrollReveal>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mt-3 text-h2 leading-heading text-brand-black">{presentation.intro.heading}</h2>
          <p className="mt-6 text-lg leading-body-lg text-dark-grey">{presentation.intro.description}</p>
          <CampaignStartButton />
        </div>
      </ScrollReveal>
    </div>
    <section aria-label="Giving opportunities" className="bg-white px-5 pb-16 lg:px-8 lg:pb-24">
      <div className="mx-auto grid max-w-[80rem] gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {opportunities.map(opportunity => <article key={opportunity.giftId} data-campaign-card={opportunity.giftId}
          className="flex flex-col overflow-hidden rounded-2xl border border-warm-grey bg-white">
          <div className="relative aspect-[3/2]">
            {opportunity.image ? <MediaImage media={opportunity.image} mediaSize="large" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
              : <div aria-hidden="true" className="flex h-full items-center justify-center bg-brand-black"><FiHeart className="h-20 w-20 text-rich-red" strokeWidth={1} /></div>}
          </div>
          <div className="flex flex-1 flex-col p-6 lg:p-7">
            <h2 className="text-xl font-bold leading-heading text-brand-black">{opportunity.heading}</h2>
            <p className="mt-4 leading-relaxed text-dark-grey">{opportunity.description}</p>
            {!['cambodia', 'greatest-need'].includes(opportunity.giftId) && <div className="mt-auto">
              <CampaignProgress showPending={false} progressKey={opportunity.giftId as CampaignProgressKey} title={opportunity.heading} values={CAMPAIGN_PROGRESS[opportunity.giftId as CampaignProgressKey]} />
            </div>}
          </div>
        </article>)}
      </div>
      <CampaignStartButton />
    </section>
  </>
}

export function CampaignRegularGiving() {
  return <CTABlockComponent {...presentation.regularGiving} colorPreset="primary-red"
    buttons={[{ label: 'Regular giving', href: '/give', variant: 'primary' }]} />
}
