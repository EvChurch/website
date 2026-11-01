'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react'

import type { GivingServerEligibility } from '@/lib/giving/availability'
import type { PublicSupportProfile } from '@/lib/giving/support-profiles'

export type GivingFlagState = 'unresolved' | 'enabled' | 'disabled' | 'failed'

interface GivingExperienceContextValue {
  supportProfiles: PublicSupportProfile[]
  directedFundId: number | null
  selectGivingFund: (fundId: number | null) => void
  flagState: GivingFlagState
  blinkPayEnabled: boolean
  cardEnabled: boolean
  givingSurfaceAvailable: boolean
  givingExperience: ReactNode | null
  givingRequestId: number
  givingDismissRequestId: number
  givingViewActive: boolean
  consumeGivingRequest: (requestId: number) => boolean
  consumeGivingDismissRequest: (requestId: number) => boolean
  dismissGiving: () => boolean
  openGiving: (fundId?: number) => boolean
  setFlagState: (state: GivingFlagState) => void
  setGivingViewActive: (active: boolean) => void
  handleGivingBack: () => boolean
  registerGivingBackHandler: (handler: () => boolean) => () => void
  handleGivingClose: () => boolean
  registerGivingCloseHandler: (handler: () => boolean) => () => void
}

const disabledContext: GivingExperienceContextValue = {
  supportProfiles: [],
  directedFundId: null,
  selectGivingFund: () => undefined,
  flagState: 'failed',
  blinkPayEnabled: false,
  cardEnabled: false,
  givingSurfaceAvailable: false,
  givingExperience: null,
  givingRequestId: 0,
  givingDismissRequestId: 0,
  givingViewActive: false,
  consumeGivingRequest: () => false,
  consumeGivingDismissRequest: () => false,
  dismissGiving: () => false,
  openGiving: () => false,
  setFlagState: () => undefined,
  setGivingViewActive: () => undefined,
  handleGivingBack: () => false,
  registerGivingBackHandler: () => () => undefined,
  handleGivingClose: () => false,
  registerGivingCloseHandler: () => () => undefined,
}

const GivingExperienceContext = createContext(disabledContext)

export function GivingExperienceProvider({
  children,
  givingExperience = null,
  serverEligibility,
  blinkPayEligibilityResolved = true,
  blinkPayEligible = false,
  resumeRequested = false,
  supportProfiles = [],
  bankAvailable = true,
  cardAvailable = false,
}: {
  children: ReactNode
  givingExperience?: ReactNode
  serverEligibility: GivingServerEligibility
  blinkPayEligibilityResolved?: boolean
  blinkPayEligible?: boolean
  resumeRequested?: boolean
  supportProfiles?: PublicSupportProfile[]
  bankAvailable?: boolean
  cardAvailable?: boolean
}) {
  const [directedFundId, setDirectedFundId] = useState<number | null>(null)
  const [flagOverride, setFlagOverride] = useState<GivingFlagState | null>(null)
  const [givingRequestId, setGivingRequestId] = useState(0)
  const [givingDismissRequestId, setGivingDismissRequestId] = useState(0)
  const [givingViewActive, setGivingViewActive] = useState(false)
  const consumedRequestId = useRef(0)
  const consumedDismissRequestId = useRef(0)
  const resumedFromCleanUrl = useRef(false)
  const givingBackHandler = useRef<(() => boolean) | null>(null)
  const givingCloseHandler = useRef<(() => boolean) | null>(null)
  const rendererReady = givingExperience !== null
  const givingSurfaceAvailable = rendererReady
  const flagState = flagOverride ?? (!blinkPayEligibilityResolved ? 'unresolved' : blinkPayEligible ? 'enabled' : 'disabled')
  const blinkPayAllowed = flagOverride ? flagOverride === 'enabled' : blinkPayEligibilityResolved && blinkPayEligible
  const blinkPayEnabled = serverEligibility !== null && blinkPayAllowed && bankAvailable
  const cardEnabled = serverEligibility !== null && blinkPayAllowed && cardAvailable

  const openGiving = useCallback((fundId?: number) => {
    if (!rendererReady) return false
    setDirectedFundId(fundId ?? null)
    setGivingRequestId((requestId) => requestId + 1)
    return true
  }, [rendererReady])
  const dismissGiving = useCallback(() => {
    if (!givingViewActive) return false
    setGivingDismissRequestId((requestId) => requestId + 1)
    return true
  }, [givingViewActive])

  useEffect(() => {
    if (!rendererReady || resumedFromCleanUrl.current) return
    if (!resumeRequested) return
    resumedFromCleanUrl.current = true
    setGivingRequestId((requestId) => requestId + 1)
  }, [rendererReady, resumeRequested])

  const handleGivingBack = useCallback(() => givingBackHandler.current?.() ?? false, [])
  const registerGivingBackHandler = useCallback((handler: () => boolean) => {
    givingBackHandler.current = handler
    return () => {
      if (givingBackHandler.current === handler) givingBackHandler.current = null
    }
  }, [])
  const handleGivingClose = useCallback(() => givingCloseHandler.current?.() ?? false, [])
  const registerGivingCloseHandler = useCallback((handler: () => boolean) => {
    givingCloseHandler.current = handler
    return () => {
      if (givingCloseHandler.current === handler) givingCloseHandler.current = null
    }
  }, [])

  const consumeGivingRequest = useCallback((requestId: number) => {
    if (requestId <= consumedRequestId.current || requestId !== givingRequestId) {
      return false
    }
    consumedRequestId.current = requestId
    return true
  }, [givingRequestId])
  const consumeGivingDismissRequest = useCallback((requestId: number) => {
    if (requestId <= consumedDismissRequestId.current || requestId !== givingDismissRequestId) return false
    consumedDismissRequestId.current = requestId
    return true
  }, [givingDismissRequestId])

  const value = useMemo<GivingExperienceContextValue>(() => ({
    supportProfiles,
    directedFundId,
    selectGivingFund: setDirectedFundId,
    flagState,
    blinkPayEnabled,
    cardEnabled,
    givingSurfaceAvailable,
    givingExperience: givingExperience === null ? null : <div key={directedFundId === null ? 'general' : `directed-${directedFundId}-${givingRequestId}`} className="h-full">{givingExperience}</div>,
    givingRequestId,
    givingDismissRequestId,
    givingViewActive,
    consumeGivingRequest,
    consumeGivingDismissRequest,
    dismissGiving,
    handleGivingBack,
    handleGivingClose,
    openGiving,
    registerGivingBackHandler,
    registerGivingCloseHandler,
    setFlagState: setFlagOverride,
    setGivingViewActive,
  }), [
    supportProfiles,
    directedFundId,
    consumeGivingRequest,
    consumeGivingDismissRequest,
    dismissGiving,
    blinkPayEligibilityResolved,
    blinkPayEligible,
    flagOverride,
    blinkPayEnabled,
    cardEnabled,
    flagState,
    givingSurfaceAvailable,
    givingExperience,
    givingRequestId,
    givingDismissRequestId,
    givingViewActive,
    handleGivingBack,
    handleGivingClose,
    openGiving,
    registerGivingBackHandler,
    registerGivingCloseHandler,
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
