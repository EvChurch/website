// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const turnstileMocks = vi.hoisted(() => ({
  onToken: null as ((token: string) => void) | null,
  onError: null as ((message: string) => void) | null,
}))

vi.mock('./TurnstileWidget', () => ({
  TurnstileWidget: ({
    onToken,
    onError,
  }: {
    onToken: (token: string) => void
    onError?: (message: string) => void
  }) => {
    turnstileMocks.onToken = onToken
    turnstileMocks.onError = onError || null
    return <div aria-label="Security check" />
  },
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
  afterEach(() => {
    vi.unstubAllGlobals()
    turnstileMocks.onToken = null
    turnstileMocks.onError = null
  })

  it('shows an accessible retry and contact fallback when startup returns non-JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('error code: 502', {
          status: 502,
          headers: { 'content-type': 'text/plain' },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ turnstileSiteKey: 'site-key' }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <RockForm
            workflowTypeGuid={workflowTypeGuid}
            fallbackAction={{
              label: 'Message our welcome team',
              href: '/contact?topic=visit',
            }}
          />,
        )
      })

      await vi.waitFor(() => {
        expect(container.querySelector('[role="alert"]')?.textContent).toContain(
          'temporarily unavailable',
        )
      })
      expect(container.textContent).toContain('Try again')
      expect(
        container.querySelector<HTMLAnchorElement>(
          'a[href="/contact?topic=visit"]',
        )?.textContent,
      ).toBe('Message our welcome team')
      expect(container.textContent).not.toContain('error code: 502')

      await act(async () => {
        container.querySelector<HTMLButtonElement>('button')?.click()
      })

      await vi.waitFor(() => {
        expect(container.textContent).toContain('Preparing secure form')
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        `/api/rock-entry-forms/${workflowTypeGuid}`,
      )
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

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

  it('stacks configured Rock columns until the form container is wide enough', () => {
    const markup = renderToStaticMarkup(
      <RockForm
        workflowTypeGuid={workflowTypeGuid}
        initialSchema={{
          ...schema(),
          fields: schema().fields.map((field) => ({ ...field, columnSize: 6 })),
        }}
      />,
    )

    expect(markup).toContain('class="@container/rock-form space-y-8"')
    expect(markup).toContain('class="col-span-12 @md/rock-form:col-span-6"')
    expect(markup).not.toContain('sm:col-span-6')
    expect(markup).not.toContain('grid-column:span 6')
  })

  it('uses the shared native select styling for Rock select fields', () => {
    const selectFields: RockFormSchema['fields'] = [
      {
        attribute: {
          fieldTypeGuid: ROCK_FIELD_TYPES.singleSelect,
          attributeGuid: '22222222-2222-4222-8222-222222222222',
          name: 'Campus',
          key: 'Campus',
          configurationValues: {
            values: JSON.stringify([
              { text: 'North', value: '1' },
              { text: 'Central', value: '2' },
            ]),
          },
        },
        isRequired: true,
      },
      {
        attribute: {
          fieldTypeGuid: ROCK_FIELD_TYPES.boolean,
          attributeGuid: '33333333-3333-4333-8333-333333333333',
          name: 'First visit',
          key: 'FirstVisit',
          configurationValues: {},
        },
      },
      {
        attribute: {
          fieldTypeGuid: ROCK_FIELD_TYPES.gender,
          attributeGuid: '44444444-4444-4444-8444-444444444444',
          name: 'Gender',
          key: 'Gender',
          configurationValues: {},
        },
      },
    ]
    const markup = renderToStaticMarkup(
      <RockForm
        workflowTypeGuid={workflowTypeGuid}
        initialSchema={{ ...schema(), fields: selectFields }}
      />,
    )

    expect(markup.match(/data-form-select="true"/g)).toHaveLength(3)
    expect(markup).toContain('<select required=""')
    expect(markup).toContain('North')
    expect(markup).toContain('First visit')
    expect(markup).toContain('Female')
  })

  it('uses the shared responsive calendar for Rock date fields', async () => {
    const dateGuid = '55555555-5555-4555-8555-555555555555'
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <RockForm
            workflowTypeGuid={workflowTypeGuid}
            initialSchema={{
              ...schema(),
              contextToken: 'signed-context',
              fields: [{
                attribute: {
                  fieldTypeGuid: ROCK_FIELD_TYPES.date,
                  attributeGuid: dateGuid,
                  name: 'Date',
                  key: 'Date',
                  configurationValues: {},
                },
                isRequired: true,
              }],
              initialFieldValues: { [dateGuid]: '2026-08-20' },
            }}
          />,
        )
      })

      expect(container.querySelector('input[type="date"]')).toBeNull()
      const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Date"]')
      expect(trigger?.textContent).toContain('20 Aug 2026')
      expect(trigger?.className).toContain('max-w-full')

      await act(async () => trigger?.click())
      expect(container.querySelector('[aria-label="Date calendar"]')).not.toBeNull()
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Choose 21 August 2026"]')?.click()
      })
      expect(trigger?.textContent).toContain('21 Aug 2026')
      expect(container.querySelector('[aria-label="Date calendar"]')).toBeNull()
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('prefills visible person-entry fields from the signed-in member profile', () => {
    const markup = renderToStaticMarkup(
      <RockForm
        workflowTypeGuid={workflowTypeGuid}
        initialSchema={spouseSchema()}
        personDefaults={{ name: 'Tatai Nikora', email: 'tatai@example.com' }}
      />,
    )

    expect(markup).toContain('value="Tatai"')
    expect(markup).toContain('value="Nikora"')
    expect(markup).toContain('value="tatai@example.com"')
  })

  it('renders blank person-entry fields when Rock omits person defaults', () => {
    const markup = renderToStaticMarkup(
      <RockForm
        workflowTypeGuid={workflowTypeGuid}
        initialSchema={{
          ...spouseSchema(),
          initialPersonEntryValues: null,
        }}
      />,
    )

    expect(markup).toContain('First name')
    expect(markup).toContain('Last name')
    expect(markup).toContain('Email *')
  })

  it('shows the retry and contact fallback when the startup security check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ turnstileSiteKey: 'site-key' })),
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(<RockForm workflowTypeGuid={workflowTypeGuid} />)
      })
      await vi.waitFor(() => expect(turnstileMocks.onError).not.toBeNull())

      await act(async () => {
        turnstileMocks.onError?.('The security check could not load.')
      })

      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        'temporarily unavailable',
      )
      expect(container.textContent).toContain('Try again')
      expect(container.textContent).toContain('Contact us another way')
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('keeps the form visible when Rock returns a malformed successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>not a form response</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <RockForm
            workflowTypeGuid={workflowTypeGuid}
            initialSchema={{ ...schema(), contextToken: 'signed-context' }}
          />,
        )
      })
      await act(async () => turnstileMocks.onToken?.('valid-token'))
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
      })

      await vi.waitFor(() => {
        expect(container.querySelector('[role="alert"]')?.textContent).toContain(
          'invalid submission response',
        )
      })
      expect(container.textContent).toContain('How can we help?')
      expect(container.textContent).not.toContain('Thanks.')
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it.each([
    [{ status: 'next', form: {} }, 'invalid next step'],
    [{ redirectUrl: '/unexpected' }, 'invalid submission response'],
    [{ status: 'complete', message: { unsafe: true } }, 'invalid submission response'],
  ])('rejects an invalid successful JSON response %#', async (response, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)))
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <RockForm
            workflowTypeGuid={workflowTypeGuid}
            initialSchema={{ ...schema(), contextToken: 'signed-context' }}
          />,
        )
      })
      await act(async () => turnstileMocks.onToken?.('valid-token'))
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
      })

      await vi.waitFor(() => {
        expect(container.querySelector('[role="alert"]')?.textContent).toContain(message)
      })
      expect(container.textContent).toContain('How can we help?')
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('scrolls its host container after advancing to the next step', async () => {
    const nextSchema = {
      ...schema(),
      contextToken: 'next-context',
      headerHtml: '<p>Step two</p>',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ status: 'next', form: nextSchema }),
      ),
    )
    const windowScroll = vi.fn()
    vi.stubGlobal('scrollTo', windowScroll)
    const host = document.createElement('div')
    const hostScroll = vi.fn()
    host.scrollTo = hostScroll
    const container = document.createElement('div')
    host.appendChild(container)
    document.body.appendChild(host)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <RockForm
            workflowTypeGuid={workflowTypeGuid}
            initialSchema={{ ...schema(), contextToken: 'signed-context' }}
            scrollContainerRef={{ current: host }}
          />,
        )
      })
      await act(async () => turnstileMocks.onToken?.('valid-token'))
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
      })

      await vi.waitFor(() => expect(hostScroll).toHaveBeenCalledWith({
        top: 0,
        behavior: 'smooth',
      }))
      expect(windowScroll).not.toHaveBeenCalled()
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })

  it('rejects an incomplete schema returned during form startup', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ turnstileSiteKey: 'site-key' }))
      .mockResolvedValueOnce(Response.json({ contextToken: 'incomplete' }))
    vi.stubGlobal('fetch', fetchMock)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <RockForm
            workflowTypeGuid={workflowTypeGuid}
            fallbackAction={{
              label: 'Message the welcome team',
              href: '/contact?topic=visit',
            }}
          />,
        )
      })
      await vi.waitFor(() => expect(turnstileMocks.onToken).not.toBeNull())
      await act(async () => turnstileMocks.onToken?.('valid-token'))

      await vi.waitFor(() => {
        expect(container.textContent).toContain('Rock returned an invalid form')
      })
      expect(container.textContent).toContain('Try again')
      expect(container.textContent).toContain('Message the welcome team')
      expect(container.querySelector('a')?.getAttribute('href')).toBe(
        '/contact?topic=visit',
      )
      expect(container.textContent).not.toContain('Preparing secure form')
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
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
