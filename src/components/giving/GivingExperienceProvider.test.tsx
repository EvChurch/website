// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  GivingExperienceProvider,
  useGivingExperience,
} from './GivingExperienceProvider'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

function Probe() {
  const giving = useGivingExperience()
  return <>
    <output data-enabled={giving.givingEnabled} data-flag={giving.flagState}>
      {giving.givingRequestId}
    </output>
    <button type="button" onClick={() => giving.setFlagState('enabled')}>enable</button>
    <button type="button" onClick={() => giving.openGiving()}>open</button>
    <button type="button" onClick={() => {
      giving.consumeGivingRequest(giving.givingRequestId)
    }}>consume</button>
    <button type="button" data-disable onClick={() => giving.setFlagState('disabled')}>disable</button>
    <button type="button" data-fail onClick={() => giving.setFlagState('failed')}>fail</button>
  </>
}

describe('GivingExperienceProvider', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
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
    expect(container.querySelector('output')?.textContent).toBe('0')
  })

  it('requires server eligibility, a positive flag, and a ready renderer to acquire', async () => {
    await act(async () => root.render(
      <GivingExperienceProvider
        serverEligibility="production"
        givingExperience={<div>Giving flow</div>}
      >
        <Probe />
      </GivingExperienceProvider>,
    ))
    expect(container.querySelector('output')?.dataset.enabled).toBe('false')
    await act(async () => container.querySelectorAll('button')[0]?.click())
    expect(container.querySelector('output')?.dataset.enabled).toBe('true')
    await act(async () => container.querySelectorAll('button')[1]?.click())
    expect(container.querySelector('output')?.textContent).toBe('1')
  })

  it('fails closed for unresolved, disabled, failed, server-ineligible, and renderer-missing states', async () => {
    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility={null} givingExperience={<div>Giving flow</div>}>
        <Probe />
      </GivingExperienceProvider>,
    ))
    await act(async () => container.querySelectorAll('button')[0]?.click())
    await act(async () => container.querySelectorAll('button')[1]?.click())
    expect(container.querySelector('output')?.dataset.enabled).toBe('false')
    expect(container.querySelector('output')?.textContent).toBe('0')

    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="production">
        <Probe />
      </GivingExperienceProvider>,
    ))
    await act(async () => container.querySelectorAll('button')[0]?.click())
    await act(async () => container.querySelectorAll('button')[1]?.click())
    expect(container.querySelector('output')?.dataset.enabled).toBe('true')
    expect(container.querySelector('output')?.textContent).toBe('0')

    await act(async () => container.querySelector<HTMLButtonElement>('[data-disable]')?.click())
    await act(async () => container.querySelectorAll('button')[1]?.click())
    expect(container.querySelector('output')?.dataset.enabled).toBe('false')
    expect(container.querySelector('output')?.textContent).toBe('0')

    await act(async () => container.querySelector<HTMLButtonElement>('[data-fail]')?.click())
    await act(async () => container.querySelectorAll('button')[1]?.click())
    expect(container.querySelector('output')?.dataset.flag).toBe('failed')
    expect(container.querySelector('output')?.textContent).toBe('0')
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
})
