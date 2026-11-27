'use client'

import { campaignProgress, campaignProgressFromReceipts, formatCampaignProgress, type CampaignProgressKey, type CampaignProgressValues } from '@/lib/giving/campaign-progress'
import { usePendingGiftAmount } from './GiveSundayCart'
import { useCampaignReceipts } from './useCampaignReceipts'

export function CampaignProgress({ title, values, progressKey, overImage = false, showPending = true }: { title: string; values: CampaignProgressValues; progressKey?: CampaignProgressKey; overImage?: boolean; showPending?: boolean }) {
  const pending = usePendingGiftAmount(progressKey)
  const { receipts, unavailable } = useCampaignReceipts(Boolean(progressKey && progressKey !== 'cambodia'))
  const current = receipts && progressKey ? campaignProgressFromReceipts(receipts)[progressKey] : values
  return <CampaignProgressDisplay title={title} values={current} pending={showPending ? pending : 0} overImage={overImage} unavailable={unavailable} />
}

export function CampaignProgressDisplay({ title, values, pending = 0, overImage = false, unavailable = false }: { title: string; values: CampaignProgressValues; pending?: number; overImage?: boolean; unavailable?: boolean }) {
  const hasPending = values.unit === 'money' && Number.isSafeInteger(pending) && pending > 0
  const projected = hasPending ? { ...values, given: (values.given ?? 0) + pending } : values
  const { goal, given } = campaignProgress(values)
  const { percent } = campaignProgress(projected)
  const givenText = unavailable ? 'Unavailable' : formatCampaignProgress(given, values.unit)
  const pendingText = formatCampaignProgress(pending, 'money')
  const goalText = formatCampaignProgress(goal, values.unit)
  const description = values.unit === 'children'
    ? `${given === null ? 'Sponsorship count not yet available' : `${givenText} children sponsored`}; ${goal === null ? 'goal not yet available' : `goal ${goalText} children`}`
    : `${given === null ? 'Amount given not yet available' : `${givenText} given`}${hasPending ? `; plus ${pendingText} from your pending gift` : ''}; ${goal === null ? 'goal not yet available' : `goal ${goalText}`}`

  return <div className={overImage ? 'relative' : 'mt-4'} data-campaign-progress>
    <div className="mb-2 flex items-end justify-between gap-3 text-sm">
      <div>
        <p className={overImage ? 'text-white/80' : 'text-mid-grey'}>{values.unit === 'children' ? 'Sponsored' : 'Given so far'}</p>
        <p aria-live="polite" className="mt-1 flex flex-wrap items-baseline gap-x-0.5 font-semibold tabular-nums">
          <span className={overImage ? 'text-white' : 'text-brand-black'}>{givenText}</span>
          {hasPending && <span className="inline-flex items-baseline gap-x-0.5 text-rich-red" aria-label={`${pendingText} pending`}><span aria-hidden="true">+</span><span>{pendingText}</span></span>}
        </p>
      </div>
      {goal !== null && <div className="text-right">
        <p className={overImage ? 'text-white/80' : 'text-mid-grey'}>Goal</p>
        <p className={`mt-1 font-semibold ${overImage ? 'text-white' : 'text-brand-black'}`}>{goalText}{values.unit === 'children' && goal !== null ? ' children' : ''}</p>
      </div>}
    </div>
    {goal !== null && <div role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={percent ?? undefined} aria-valuetext={description}
      className={`h-2 overflow-hidden rounded-full ${overImage ? 'bg-white/25' : 'bg-warm-grey/60'}`}>
      <div className="h-full rounded-full bg-rich-red" style={{ width: `${percent ?? 0}%` }} />
    </div>}
  </div>
}
