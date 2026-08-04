// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./TurnstileWidget', () => ({
  TurnstileWidget: ({ action, onToken }: { action: string; onToken: (token: string) => void }) => (
    <button type="button" data-turnstile-action={action} onClick={() => onToken(`${action}-token`)}>
      Verify
    </button>
  ),
}))

import {
  ROCK_CONNECTION_START_ACTION,
  ROCK_CONNECTION_SUBMIT_ACTION,
  RockConnectionOpportunitySignup,
} from './RockConnectionOpportunitySignup'

const blockGuid = '70f9eb00-5961-42bc-b1ea-dbcb8fce6369'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('RockConnectionOpportunitySignup mounted flow', () => {
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
    vi.restoreAllMocks()
  })

  it('keeps server-rendered fields visible while protected startup completes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        contextToken: 'signed-context',
        schema: {
          pageGuid: 'eab9cb2b-474f-4939-b665-e32b4d2e1bb2',
          blockGuid,
          blockTypeGuid: '35d5ef65-0b0d-4e99-82b5-3f5fc2e0344f',
          opportunityGuid: '11111111-1111-4111-8111-111111111111',
          opportunityName: 'Newish',
          attributes: [],
          campuses: [{ value: '3', text: 'Central' }],
          commentFieldLabel: 'Anything else?',
          disableCaptchaSupport: true,
          displayHomePhone: false,
          displayMobilePhone: false,
          selectedCampusId: 3,
          firstName: '',
          lastName: '',
          email: '',
          homePhone: null,
          mobilePhone: null,
        },
      }),
    )
    const initialSchema = {
      pageGuid: 'eab9cb2b-474f-4939-b665-e32b4d2e1bb2',
      blockGuid,
      blockTypeGuid: '35d5ef65-0b0d-4e99-82b5-3f5fc2e0344f',
      opportunityGuid: '11111111-1111-4111-8111-111111111111',
      opportunityName: 'Newish',
      attributes: [],
      campuses: [{ value: '3', text: 'Central' }],
      commentFieldLabel: 'Anything else?',
      disableCaptchaSupport: true as const,
      displayHomePhone: false,
      displayMobilePhone: false,
      selectedCampusId: 3,
      firstName: '' as const,
      lastName: '' as const,
      email: '' as const,
      homePhone: null,
      mobilePhone: null,
    }

    await act(async () => root.render(
      <RockConnectionOpportunitySignup
        blockGuid={blockGuid}
        initialSchema={initialSchema}
        initialSiteKey="site-key"
      />,
    ))

    expect(container.textContent).toContain('First name')
    expect(container.textContent).not.toContain('Loading signup')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.querySelector('fieldset')?.disabled).toBe(true)

    const start = container.querySelector<HTMLButtonElement>(
      `[data-turnstile-action="${ROCK_CONNECTION_START_ACTION}"]`,
    )
    await act(async () => start?.click())
    await settle()

    expect(container.textContent).toContain('First name')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(container.querySelector('fieldset')?.disabled).toBe(false)
  })

  it('loads, starts, submits once, and stops on an unknown outcome', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ turnstileSiteKey: 'site-key' }))
      .mockResolvedValueOnce(jsonResponse({
        contextToken: 'signed-context',
        schema: {
          pageGuid: 'eab9cb2b-474f-4939-b665-e32b4d2e1bb2',
          blockGuid,
          blockTypeGuid: '35d5ef65-0b0d-4e99-82b5-3f5fc2e0344f',
          opportunityGuid: '11111111-1111-4111-8111-111111111111',
          opportunityName: 'Newish',
          sessionGuid: '',
          interactionGuid: '',
          attributes: [],
          campuses: [{ value: '3', text: 'Central' }],
          commentFieldLabel: 'Anything else?',
          disableCaptchaSupport: true,
          displayHomePhone: false,
          displayMobilePhone: false,
          selectedCampusId: 3,
          firstName: '',
          lastName: '',
          email: '',
          homePhone: null,
          mobilePhone: null,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        error: 'The submission outcome could not be confirmed',
        outcomeUnknown: true,
      }, 504))

    await act(async () => root.render(
      <RockConnectionOpportunitySignup blockGuid={blockGuid} />,
    ))
    await settle()

    const start = container.querySelector<HTMLButtonElement>(
      `[data-turnstile-action="${ROCK_CONNECTION_START_ACTION}"]`,
    )
    expect(start).not.toBeNull()
    await act(async () => start?.click())
    await settle()
    expect(container.querySelector('form')).not.toBeNull()

    const submitTurnstile = container.querySelector<HTMLButtonElement>(
      `[data-turnstile-action="${ROCK_CONNECTION_SUBMIT_ACTION}"]`,
    )
    await act(async () => submitTurnstile?.click())
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
    })
    await settle()

    expect(container.textContent).toContain('may have succeeded')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const submitBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body))
    expect(submitBody).toMatchObject({
      intent: 'submit',
      turnstileToken: `${ROCK_CONNECTION_SUBMIT_ACTION}-token`,
      contextToken: 'signed-context',
      values: { campusId: 3 },
    })
  })
})
