// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { CampaignProgress } from './CampaignProgress'
import { CAMPAIGN_PROGRESS } from '@/lib/giving/campaign-progress'
import { refreshCampaignReceipts } from './useCampaignReceipts'
vi.mock('./GiveSundayCart',()=>({usePendingGiftAmount:()=>100000}))
;(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true

it('loads one shared aggregate request for cards and slides, then refreshes after confirmed giving without cart additions',async()=>{
  const fetchMock=vi.fn().mockResolvedValueOnce(Response.json({receipts:{plant:0,train:50000,grow:250000,build:250000,'greatest-need':0}}))
    .mockResolvedValueOnce(Response.json({receipts:{plant:20000,train:50000,grow:250000,build:270000,'greatest-need':0}}))
  vi.stubGlobal('fetch',fetchMock)
  const container=document.createElement('div');document.body.append(container)
  const root=createRoot(container)
  try{
    await act(async()=>root.render(<>
      <CampaignProgress title="Train" progressKey="train" values={CAMPAIGN_PROGRESS.train} showPending={false}/>
      <CampaignProgress title="Build" progressKey="build" values={CAMPAIGN_PROGRESS.build} showPending={false} overImage/>
    </>))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/giving/campaign-progress',{cache:'no-store',credentials:'same-origin'})
    expect(container.textContent).toContain('$500')
    expect(container.textContent).toContain('$2,500')
    expect(container.textContent).not.toContain('pending')
    await act(async()=>refreshCampaignReceipts())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('$2,700')
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()}
})
