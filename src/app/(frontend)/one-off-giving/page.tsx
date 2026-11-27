import type { Metadata } from 'next'
import DynamicPage, { generateMetadata as generateDynamicMetadata } from '../[slug]/page'
import { campaignGivingEnabled } from '@/lib/giving/campaign-enabled'
import { CampaignContent, CampaignRegularGiving } from '@/components/giving/CampaignContent'

export const revalidate = 86400

const campaignParams = () => Promise.resolve({ slug: 'one-off-giving' })

export function generateMetadata(): Promise<Metadata> | Metadata {
  if (campaignGivingEnabled()) return { title: 'One-off giving', robots: { index: false, follow: false } }
  return generateDynamicMetadata({ params: campaignParams() })
}

export default function OneOffGivingPage() {
  if (campaignGivingEnabled()) return <><CampaignContent /><CampaignRegularGiving /></>
  return DynamicPage({ params: campaignParams() })
}
