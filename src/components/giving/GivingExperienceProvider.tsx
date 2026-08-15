'use client'

import {
  createContext,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { GivingServerEligibility } from '@/lib/giving/availability'

export type GivingFlagState = 'unresolved' | 'enabled' | 'disabled' | 'failed'

interface GivingExperienceContextValue {
  flagState: GivingFlagState
  givingEnabled: boolean
  givingExperience: ReactNode | null
  givingRequestId: number
  givingViewActive: boolean
  consumeGivingRequest: (requestId: number) => boolean
  handleGivingLinkClick: (event: ReactMouseEvent<HTMLAnchorElement>) => boolean
  openGiving: () => boolean
  setFlagState: (state: GivingFlagState) => void
  setGivingViewActive: (active: boolean) => void
}

const disabledContext: GivingExperienceContextValue = {
  flagState: 'failed',
  givingEnabled: false,
  givingExperience: null,
  givingRequestId: 0,
  givingViewActive: false,
  consumeGivingRequest: () => false,
  handleGivingLinkClick: () => false,
  openGiving: () => false,
  setFlagState: () => undefined,
  setGivingViewActive: () => undefined,
}

const GivingExperienceContext = createContext(disabledContext)

export function GivingExperienceProvider({
  children,
  givingExperience = null,
  serverEligibility,
}: {
  children: ReactNode
  givingExperience?: ReactNode
  serverEligibility: GivingServerEligibility
}) {
  const [flagState, setFlagState] = useState<GivingFlagState>('unresolved')
  const [givingRequestId, setGivingRequestId] = useState(0)
  const [givingViewActive, setGivingViewActive] = useState(false)
  const consumedRequestId = useRef(0)
  const givingEnabled = serverEligibility !== null && flagState === 'enabled'
  const rendererReady = givingExperience !== null

  const openGiving = useCallback(() => {
    if (!givingEnabled || !rendererReady) return false
    setGivingRequestId((requestId) => requestId + 1)
    return true
  }, [givingEnabled, rendererReady])

  const handleGivingLinkClick = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    const target = event.currentTarget.getAttribute('target')
    const ordinaryPrimaryClick =
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      (!target || target === '_self')
    if (!ordinaryPrimaryClick || !openGiving()) return false
    event.preventDefault()
    return true
  }, [openGiving])

  const consumeGivingRequest = useCallback((requestId: number) => {
    if (requestId <= consumedRequestId.current || requestId !== givingRequestId) {
      return false
    }
    consumedRequestId.current = requestId
    return true
  }, [givingRequestId])

  const value = useMemo<GivingExperienceContextValue>(() => ({
    flagState,
    givingEnabled,
    givingExperience,
    givingRequestId,
    givingViewActive,
    consumeGivingRequest,
    handleGivingLinkClick,
    openGiving,
    setFlagState,
    setGivingViewActive,
  }), [
    consumeGivingRequest,
    flagState,
    givingEnabled,
    givingExperience,
    givingRequestId,
    givingViewActive,
    handleGivingLinkClick,
    openGiving,
  ])

  return (
    <GivingExperienceContext.Provider value={value}>
      {children}
    </GivingExperienceContext.Provider>
  )
}

export function useGivingExperience(): GivingExperienceContextValue {
  return useContext(GivingExperienceContext)
}
