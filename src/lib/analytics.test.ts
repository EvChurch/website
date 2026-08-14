// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getSuccessfulFormEvent,
  trackAnalyticsEvent,
  trackSuccessfulFormSubmission,
} from './analytics'

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/')
  delete window.gtag
})

describe('analytics events', () => {
  it.each([
    [
      '/visit',
      'workflow',
      {
        name: 'visit_plan_submit',
        parameters: { form_type: 'workflow' },
      },
    ],
    [
      '/contact',
      'workflow',
      {
        name: 'contact_church',
        parameters: { topic: 'general', method: 'form', form_type: 'workflow' },
      },
    ],
    [
      '/newish',
      'connection_opportunity',
      {
        name: 'contact_church',
        parameters: {
          topic: 'newish',
          method: 'form',
          form_type: 'connection_opportunity',
        },
      },
    ],
    [
      '/explaining-christianity',
      'connection_opportunity',
      {
        name: 'faith_exploration_enquiry',
        parameters: {
          journey: 'explaining_christianity',
          form_type: 'connection_opportunity',
        },
      },
    ],
  ] as const)('maps a successful %s form', (pathname, formType, expected) => {
    expect(getSuccessfulFormEvent(pathname, formType)).toEqual(expected)
  })

  it('does not label unsupported form contexts as meaningful outcomes', () => {
    expect(getSuccessfulFormEvent('/kids', 'workflow')).toBeNull()
    expect(getSuccessfulFormEvent('/visit', 'connection_opportunity')).toBeNull()
  })

  it('sends allowlisted parameters to gtag', () => {
    window.gtag = vi.fn()
    window.history.replaceState({}, '', '/campus/north')

    trackAnalyticsEvent('get_directions', {
      campus: 'north',
      destination_host: 'www.google.com',
    })

    expect(window.gtag).toHaveBeenCalledWith('event', 'get_directions', {
      campus: 'north',
      destination_host: 'www.google.com',
    })
  })

  it('does not send events from analytics-sensitive paths', () => {
    window.gtag = vi.fn()
    window.history.replaceState({}, '', '/members/connect-groups/123')

    trackSuccessfulFormSubmission('/contact', 'workflow')

    expect(window.gtag).not.toHaveBeenCalled()
  })
})
