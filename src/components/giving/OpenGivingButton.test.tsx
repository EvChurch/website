// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GivingExperienceProvider, useGivingExperience } from './GivingExperienceProvider'
import { OpenGivingButton } from './OpenGivingButton'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function RequestCount() {
  return <output>{useGivingExperience().givingRequestId}</output>
}

describe('OpenGivingButton', () => {
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

  it('opens the launcher giving experience', async () => {
    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility={null} givingExperience={<div>Giving flow</div>}>
        <OpenGivingButton />
        <RequestCount />
      </GivingExperienceProvider>,
    ))

    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())
    expect(container.querySelector('output')?.textContent).toBe('1')
  })
})
