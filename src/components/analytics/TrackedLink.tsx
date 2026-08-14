'use client'

import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { Button, type ButtonVariant } from '@/components/ui/Button'
import {
  trackAnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsEvents,
} from '@/lib/analytics'

interface AnalyticsProps<Name extends AnalyticsEventName> {
  eventName: Name
  eventParameters: AnalyticsEvents[Name]
}

type TrackedAnchorProps<Name extends AnalyticsEventName> =
  AnchorHTMLAttributes<HTMLAnchorElement> &
    AnalyticsProps<Name> & {
      href: string
    }

type ContextualCtaAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

function contextualCta(pathname: string, href: string) {
  if (pathname === '/connect-groups' && href === '/contact') {
    return {
      href: '/contact?topic=connect-groups',
      eventName: 'connect_group_enquiry_click' as const,
      eventParameters: { destination_path: '/contact' as const },
    }
  }
  if (pathname === '/kids' && href === '/visit') {
    return {
      href: '/visit?source=kids',
      eventName: 'ministry_enquiry_click' as const,
      eventParameters: { ministry: 'kids' as const, destination_path: '/visit' as const },
    }
  }
  if (pathname === '/youth' && href === '/contact') {
    return {
      href: '/contact?topic=youth',
      eventName: 'ministry_enquiry_click' as const,
      eventParameters: { ministry: 'youth' as const, destination_path: '/contact' as const },
    }
  }
  return null
}

export function TrackedAnchor<Name extends AnalyticsEventName>({
  eventName,
  eventParameters,
  onClick,
  ...props
}: TrackedAnchorProps<Name>) {
  return (
    <a
      {...props}
      onClick={(event) => {
        trackAnalyticsEvent(eventName, eventParameters)
        onClick?.(event)
      }}
    />
  )
}

export function ContextualCtaAnchor({
  href,
  onClick,
  ...props
}: ContextualCtaAnchorProps) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        const context = contextualCta(window.location.pathname, href)
        if (context) {
          event.currentTarget.setAttribute('href', context.href)
          trackAnalyticsEvent(context.eventName, context.eventParameters)
        }
        onClick?.(event)
      }}
    />
  )
}

export function TrackedButtonLink<Name extends AnalyticsEventName>({
  eventName,
  eventParameters,
  href,
  external,
  variant,
  className,
  children,
}: AnalyticsProps<Name> & {
  href: string
  external?: boolean
  variant?: ButtonVariant
  className?: string
  children: ReactNode
}) {
  return (
    <Button
      href={href}
      external={external}
      variant={variant}
      className={className}
      onClick={() => trackAnalyticsEvent(eventName, eventParameters)}
    >
      {children}
    </Button>
  )
}
