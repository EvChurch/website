import { canTrackAnalyticsPath } from './analytics-privacy'

type AnalyticsValue = string | number | boolean

export interface AnalyticsEvents {
  get_directions: {
    campus: 'north' | 'central' | 'unichurch'
    destination_host: string
  }
  event_registration_click: {
    event_slug: string
    campus: string
    destination_host: string
  }
  visit_plan_submit: {
    form_type: 'workflow'
  }
  contact_church: {
    topic: 'general' | 'newish'
    method: 'form'
    form_type: 'workflow' | 'connection_opportunity'
  }
  faith_exploration_enquiry: {
    journey: 'explaining_christianity'
    form_type: 'connection_opportunity'
  }
}

export type AnalyticsEventName = keyof AnalyticsEvents

export interface SuccessfulFormEvent<Name extends AnalyticsEventName = AnalyticsEventName> {
  name: Name
  parameters: AnalyticsEvents[Name]
}

export function getSuccessfulFormEvent(
  pathname: string,
  formType: 'workflow' | 'connection_opportunity',
): SuccessfulFormEvent | null {
  switch (pathname) {
    case '/visit':
      return formType === 'workflow'
        ? {
            name: 'visit_plan_submit',
            parameters: { form_type: 'workflow' },
          }
        : null
    case '/contact':
      return {
        name: 'contact_church',
        parameters: {
          topic: 'general',
          method: 'form',
          form_type: formType,
        },
      }
    case '/newish':
      return {
        name: 'contact_church',
        parameters: {
          topic: 'newish',
          method: 'form',
          form_type: formType,
        },
      }
    case '/explaining-christianity':
      return formType === 'connection_opportunity'
        ? {
            name: 'faith_exploration_enquiry',
            parameters: {
              journey: 'explaining_christianity',
              form_type: 'connection_opportunity',
            },
          }
        : null
    default:
      return null
  }
}

export function trackAnalyticsEvent<Name extends AnalyticsEventName>(
  name: Name,
  parameters: AnalyticsEvents[Name],
): void {
  if (typeof window === 'undefined' || !canTrackAnalyticsPath(window.location.pathname)) {
    return
  }

  const safeParameters: Record<string, AnalyticsValue> = {}
  for (const [key, value] of Object.entries(parameters) as Array<
    [string, unknown]
  >) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      safeParameters[key] = value
    }
  }
  window.gtag?.('event', name, safeParameters)
}

export function trackSuccessfulFormSubmission(
  pathname: string,
  formType: 'workflow' | 'connection_opportunity',
): void {
  const event = getSuccessfulFormEvent(pathname, formType)
  if (!event) return

  trackAnalyticsEvent(event.name, event.parameters)
}
