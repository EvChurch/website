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

import { RockForm } from './RockForm'
import {
  formInputClass,
  formLabelClass,
  formRootClass,
  formSubmitClass,
  formTwoColumnGridClass,
} from './form-styles'
import { ROCK_FIELD_TYPES } from '@/lib/rock-forms/field-types'
import {
  ROCK_FORM_START_ACTION,
  ROCK_FORM_SUBMIT_ACTION,
} from '@/lib/rock-forms/constants'

const workflowTypeGuid = '11111111-1111-4111-8111-111111111111'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('RockForm mounted presentation', () => {
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

  it('applies the shared live-site presentation to person and workflow fields', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ turnstileSiteKey: 'site-key' }))
      .mockResolvedValueOnce(
        jsonResponse({
          workflowTypeGuid,
          workflowName: 'Contact us',
          headerHtml: '',
          footerHtml: '',
          sections: [{ id: 'details', title: null, description: null }],
          fields: [
            {
              attribute: {
                fieldTypeGuid: ROCK_FIELD_TYPES.text,
                attributeGuid: '22222222-2222-4222-8222-222222222222',
                name: 'Comments',
                key: 'Comments',
                configurationValues: {},
              },
              sectionId: 'details',
              columnSize: 12,
            },
          ],
          personEntry: {
            isCampusVisible: false,
            genderOption: 0,
            emailOption: 2,
            mobilePhoneOption: 1,
            isSmsVisible: false,
            addressOption: 0,
            maritalStatusOption: 0,
            birthDateOption: 0,
            spouseOption: 0,
            raceOption: 0,
            ethnicityOption: 0,
          },
          initialFieldValues: {},
          initialPersonEntryValues: { person: {} },
          buttons: [{ action: 'submit', title: 'Submit' }],
          contextToken: 'signed-context',
          turnstileSiteKey: 'site-key',
        }),
      )

    await act(async () => root.render(<RockForm workflowTypeGuid={workflowTypeGuid} />))
    await settle()

    const start = container.querySelector<HTMLButtonElement>(
      `[data-turnstile-action="${ROCK_FORM_START_ACTION}"]`,
    )
    expect(start).not.toBeNull()
    await act(async () => start?.click())
    await settle()

    const form = container.querySelector('form')
    expect(form?.className).toBe(formRootClass)

    const firstName = container.querySelector<HTMLInputElement>(
      'input[autocomplete="given-name"]',
    )
    expect(firstName?.className).toBe(formInputClass)
    expect(firstName?.closest('label')?.className).toBe(formLabelClass)
    expect(firstName?.closest('div')?.className).toBe(formTwoColumnGridClass)

    const commentsLabel = [...container.querySelectorAll('label')].find((label) =>
      label.textContent?.includes('Comments'),
    )
    expect(commentsLabel?.className).toBe(formLabelClass)
    expect(commentsLabel?.querySelector('input')?.className).toBe(formInputClass)

    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.className).toBe(
      formSubmitClass,
    )
    expect(
      container.querySelector(`[data-turnstile-action="${ROCK_FORM_SUBMIT_ACTION}"]`),
    ).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
