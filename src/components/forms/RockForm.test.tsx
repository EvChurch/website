// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./TurnstileWidget', () => ({
  TurnstileWidget: () => <div aria-label="Security check" />,
}))

import { ROCK_FIELD_TYPES } from '@/lib/rock-forms/field-types'
import type { RockFormSchema } from '@/lib/rock-forms/types'
import { RockForm } from './RockForm'

const workflowTypeGuid = '00778880-81fe-4871-aa91-7c81783b8c4d'

function schema(): RockFormSchema {
  return {
    workflowTypeGuid,
    workflowName: 'Contact us',
    headerHtml: '',
    footerHtml: '',
    sections: [],
    fields: [
      {
        attribute: {
          fieldTypeGuid: ROCK_FIELD_TYPES.text,
          attributeGuid: '11111111-1111-4111-8111-111111111111',
          name: 'How can we help?',
          key: 'Help',
          configurationValues: {},
        },
      },
    ],
    personEntry: null,
    initialFieldValues: {},
    initialPersonEntryValues: null,
    buttons: [{ action: 'submit', title: 'Send' }],
    contextToken: '',
    turnstileSiteKey: 'site-key',
  }
}

function spouseSchema(): RockFormSchema {
  return {
    ...schema(),
    contextToken: 'signed-context',
    fields: [],
    personEntry: {
      isCampusVisible: false,
      genderOption: 0,
      emailOption: 2,
      mobilePhoneOption: 1,
      isSmsVisible: false,
      addressOption: 0,
      maritalStatusOption: 0,
      birthDateOption: 0,
      spouseOption: 1,
      spouseLabel: 'Spouse',
      raceOption: 0,
      ethnicityOption: 0,
    },
    initialPersonEntryValues: {
      person: {},
      spouse: null,
    },
  }
}

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

describe('RockForm', () => {
  it('includes initialized fields in the server-rendered HTML', () => {
    const markup = renderToStaticMarkup(
      <RockForm workflowTypeGuid={workflowTypeGuid} initialSchema={schema()} />,
    )

    expect(markup).toContain('How can we help?')
    expect(markup).toContain('Send')
    expect(markup).toContain('<form')
    expect(markup).toContain('<input')
    expect(markup).toContain('disabled=""')
    expect(markup).not.toContain('Loading form')
    expect(markup).not.toContain('Preparing secure form')
  })

  it('renders the optional spouse fields as an aligned collapsed section', () => {
    const markup = renderToStaticMarkup(
      <RockForm
        workflowTypeGuid={workflowTypeGuid}
        initialSchema={spouseSchema()}
      />,
    )

    expect(markup).toContain('Show Spouse')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('grid-template-rows:0fr')
    expect(markup).toContain('items-center')
    expect(markup).toContain('pb-4')
  })

  it('expands, enables, and collapses the optional spouse fields', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <RockForm
            workflowTypeGuid={workflowTypeGuid}
            initialSchema={spouseSchema()}
          />,
        )
      })

      const checkbox = container.querySelector<HTMLInputElement>(
        'input[type="checkbox"]',
      )
      expect(checkbox).not.toBeNull()

      const panelId = checkbox?.getAttribute('aria-controls')
      const panel = panelId ? document.getElementById(panelId) : null
      const spouseFields = panel?.querySelector('fieldset')

      expect(checkbox?.getAttribute('aria-expanded')).toBe('false')
      expect(panel?.style.gridTemplateRows).toBe('0fr')
      expect(spouseFields?.disabled).toBe(true)

      await act(async () => checkbox?.click())

      expect(checkbox?.getAttribute('aria-expanded')).toBe('true')
      expect(panel?.style.gridTemplateRows).toBe('1fr')
      expect(spouseFields?.disabled).toBe(false)

      await act(async () => checkbox?.click())

      expect(checkbox?.getAttribute('aria-expanded')).toBe('false')
      expect(panel?.style.gridTemplateRows).toBe('0fr')
      expect(spouseFields?.disabled).toBe(true)
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })
})
