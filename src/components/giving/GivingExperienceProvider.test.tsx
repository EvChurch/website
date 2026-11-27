// @vitest-environment happy-dom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GivingExperienceProvider,
  useGivingExperience,
} from './GivingExperienceProvider'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

function Probe() {
  const giving = useGivingExperience()
  return <>
    <output data-enabled={giving.givingSurfaceAvailable} data-blinkpay={giving.blinkPayEnabled} data-flag={giving.flagState}>
      {`${giving.givingRequestId}:${giving.givingDismissRequestId}`}
    </output>
    <button type="button" onClick={() => giving.setFlagState('enabled')}>enable</button>
    <button type="button" onClick={() => giving.openGiving()}>open</button>
    <button type="button" onClick={() => {
      giving.consumeGivingRequest(giving.givingRequestId)
    }}>consume</button>
    <button type="button" data-disable onClick={() => giving.setFlagState('disabled')}>disable</button>
    <button type="button" data-fail onClick={() => giving.setFlagState('failed')}>fail</button>
    <button type="button" data-giving-back onClick={() => giving.handleGivingBack()}>giving back</button>
    <button type="button" data-giving-close onClick={() => giving.handleGivingClose()}>giving close</button>
    <button type="button" data-giving-dismiss onClick={() => giving.dismissGiving()}>dismiss giving</button>
  </>
}

function CampaignProbe() {
  const giving = useGivingExperience()
  return <>
    <button data-campaign-open onClick={() => giving.openCampaignGiving()}>Campaign</button>
    <button data-regular-open onClick={() => giving.openGiving()}>Regular</button>
    <button data-directed-open onClick={() => giving.selectGivingFund(42)}>Directed</button>
    <div data-renderer>{giving.givingExperience}</div>
    <output data-payment-enabled={giving.cardEnabled || giving.blinkPayEnabled}>{giving.givingRequestId}:{giving.directedFundId}</output>
  </>
}

describe('GivingExperienceProvider', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    sessionStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('opens campaign giving separately and leaves regular giving and payment eligibility intact', async () => {
    await act(async () => root.render(<GivingExperienceProvider serverEligibility={null}
      givingExperience={<p>Regular giving form</p>} campaignGivingExperience={<p>Campaign opportunities</p>} campaignGivingAllowed><CampaignProbe /></GivingExperienceProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-campaign-open]')!.click())
    expect(container.querySelector('[data-renderer]')?.textContent).toBe('Campaign opportunities')
    expect(container.querySelector('output')?.dataset.paymentEnabled).toBe('false')
    await act(async () => container.querySelector<HTMLButtonElement>('[data-regular-open]')!.click())
    expect(container.querySelector('[data-renderer]')?.textContent).toBe('Regular giving form')
    await act(async () => container.querySelector<HTMLButtonElement>('[data-campaign-open]')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-directed-open]')!.click())
    expect(container.querySelector('[data-renderer]')?.textContent).toBe('Regular giving form')
    expect(container.querySelector('output')?.textContent).toBe('3:42')
  })

  it('blocks the campaign launcher when the access flag denies access', async () => {
    await act(async () => root.render(<GivingExperienceProvider serverEligibility={null}
      givingExperience={<p>Regular giving form</p>} campaignGivingExperience={<p>Campaign opportunities</p>} campaignGivingAllowed={false}><CampaignProbe /></GivingExperienceProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-campaign-open]')!.click())
    expect(container.querySelector('[data-renderer]')?.textContent).toBe('Regular giving form')
    expect(container.querySelector('output')?.textContent).toBe('0:')
    await act(async () => container.querySelector<HTMLButtonElement>('[data-regular-open]')!.click())
    expect(container.querySelector('output')?.textContent).toBe('1:')
  })

  it('resumes the campaign payment after a provider return when its local marker is present', async () => {
    sessionStorage.setItem('ev-give-sunday-payment','submitted')
    await act(async () => root.render(<GivingExperienceProvider serverEligibility={null} resumeRequested campaignGivingAllowed
      givingExperience={<p>Regular giving form</p>} campaignGivingExperience={<p>Campaign opportunities</p>}><CampaignProbe /></GivingExperienceProvider>))
    expect(container.querySelector('[data-renderer]')?.textContent).toBe('Campaign opportunities')
    expect(container.querySelector('output')?.textContent).toBe('1:')
  })

  it('does not open a campaign when no campaign renderer is configured', async () => {
    await act(async () => root.render(<GivingExperienceProvider serverEligibility={null} givingExperience={<p>Regular giving form</p>}><CampaignProbe /></GivingExperienceProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-campaign-open]')!.click())
    expect(container.querySelector('[data-renderer]')?.textContent).toBe('Regular giving form')
    expect(container.querySelector('output')?.textContent).toBe('0:')
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('defaults to a disabled no-op outside a provider', async () => {
    await act(async () => root.render(<Probe />))
    expect(container.querySelector('output')?.dataset).toMatchObject({
      enabled: 'false',
      flag: 'failed',
    })
    await act(async () => container.querySelectorAll('button')[1]?.click())
    expect(container.querySelector('output')?.textContent).toBe('0:0')
  })

  it('opens the giving interface whenever its renderer is ready', async () => {
    await act(async () => root.render(
      <GivingExperienceProvider
        serverEligibility="production"
        givingExperience={<div>Giving flow</div>}
      >
        <Probe />
      </GivingExperienceProvider>,
    ))
    expect(container.querySelector('output')?.dataset.enabled).toBe('true')
    await act(async () => container.querySelectorAll('button')[1]?.click())
    expect(container.querySelector('output')?.textContent).toBe('1:0')
  })

  it('leaves ordinary /give links to normal navigation', async () => {
    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility={null} givingExperience={<div>Giving flow</div>}>
        <Probe />
        <a href="/give">Giving page</a>
      </GivingExperienceProvider>,
    ))
    const give = container.querySelector<HTMLAnchorElement>('a[href="/give"]')!
    const ordinaryClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    await act(async () => give.dispatchEvent(ordinaryClick))
    expect(ordinaryClick.defaultPrevented).toBe(false)
    expect(container.querySelector('output')?.textContent).toBe('0:0')
  })

  it('uses the flag and server eligibility only for the BlinkPay handoff', async () => {
    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility={null} givingExperience={<div>Giving flow</div>}>
        <Probe />
      </GivingExperienceProvider>,
    ))
    await act(async () => container.querySelectorAll('button')[1]?.click())
    expect(container.querySelector('output')?.dataset.enabled).toBe('true')
    expect(container.querySelector('output')?.dataset.blinkpay).toBe('false')
    expect(container.querySelector('output')?.textContent).toBe('1:0')

    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="production" givingExperience={<div>Giving flow</div>}>
        <Probe />
      </GivingExperienceProvider>,
    ))
    await act(async () => container.querySelectorAll('button')[0]?.click())
    expect(container.querySelector('output')?.dataset.blinkpay).toBe('true')

    await act(async () => container.querySelector<HTMLButtonElement>('[data-disable]')?.click())
    expect(container.querySelector('output')?.dataset.enabled).toBe('true')
    expect(container.querySelector('output')?.dataset.blinkpay).toBe('false')
    await act(async () => container.querySelectorAll('button')[1]?.click())
    expect(container.querySelector('output')?.textContent).toBe('2:0')

    await act(async () => container.querySelector<HTMLButtonElement>('[data-fail]')?.click())
    expect(container.querySelector('output')?.dataset.enabled).toBe('true')
    expect(container.querySelector('output')?.dataset.flag).toBe('failed')
    expect(container.querySelector('output')?.dataset.blinkpay).toBe('false')
    await act(async () => container.querySelectorAll('button')[1]?.click())
    expect(container.querySelector('output')?.textContent).toBe('3:0')
  })

  it('reports BlinkPay eligibility as unresolved until the member audience check completes', async () => {
    await act(async () => root.render(
      <GivingExperienceProvider
        serverEligibility="production"
        blinkPayEligibilityResolved={false}
        givingExperience={<div>Giving flow</div>}
      >
        <Probe />
      </GivingExperienceProvider>,
    ))

    expect(container.querySelector('output')?.dataset).toMatchObject({
      flag: 'unresolved',
      blinkpay: 'false',
    })

    await act(async () => root.render(
      <GivingExperienceProvider
        serverEligibility="production"
        blinkPayEligibilityResolved
        blinkPayEligible
        givingExperience={<div>Giving flow</div>}
      >
        <Probe />
      </GivingExperienceProvider>,
    ))

    expect(container.querySelector('output')?.dataset).toMatchObject({
      flag: 'enabled',
      blinkpay: 'true',
    })
  })

  it('consumes each monotonic open request once and never reuses a stale id', async () => {
    function Consumer() {
      const giving = useGivingExperience()
      const first = giving.consumeGivingRequest(giving.givingRequestId)
      const second = giving.consumeGivingRequest(giving.givingRequestId)
      return <output>{`${first}:${second}`}</output>
    }

    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="production">
        <Consumer />
      </GivingExperienceProvider>,
    ))
    expect(container.textContent).toBe('false:false')
  })

  it('delegates shared launcher Back to the registered giving history handler', async () => {
    const back = vi.fn(() => true)
    function Registration() {
      const giving = useGivingExperience()
      useEffect(() => giving.registerGivingBackHandler(back), [giving])
      return <Probe />
    }
    await act(async () => root.render(<GivingExperienceProvider serverEligibility="production"><Registration /></GivingExperienceProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-giving-back]')?.click())
    expect(back).toHaveBeenCalledOnce()
  })

  it('delegates launcher Close to the registered giving submit guard and cleans it up', async () => {
    const close = vi.fn(() => true)
    function Registration({ active }: { active: boolean }) {
      const giving = useGivingExperience()
      useEffect(() => active ? giving.registerGivingCloseHandler(close) : undefined, [active, giving.registerGivingCloseHandler])
      return <Probe />
    }
    await act(async () => root.render(<GivingExperienceProvider serverEligibility="production"><Registration active /></GivingExperienceProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-giving-close]')?.click())
    expect(close).toHaveBeenCalledOnce()
    await act(async () => root.render(<GivingExperienceProvider serverEligibility="production"><Registration active={false} /></GivingExperienceProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-giving-close]')?.click())
    expect(close).toHaveBeenCalledOnce()
  })

  it('issues a single dismiss request only while the giving view is active', async () => {
    function ActiveProbe() {
      const giving = useGivingExperience()
      useEffect(() => giving.setGivingViewActive(true), [giving.setGivingViewActive])
      return <Probe />
    }

    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="production">
        <ActiveProbe />
      </GivingExperienceProvider>,
    ))
    await act(async () => container.querySelector<HTMLButtonElement>('[data-giving-dismiss]')?.click())
    expect(container.querySelector('output')?.textContent).toBe('0:1')
  })
})
