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
