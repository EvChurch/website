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

export type GivingFlagState = 'unresolved' | 'enabled' | 'disabled' | 'failed'

interface GivingExperienceContextValue {
  flagState: GivingFlagState
  blinkPayEnabled: boolean
  givingSurfaceAvailable: boolean
  givingExperience: ReactNode | null
  givingRequestId: number
  givingViewActive: boolean
  consumeGivingRequest: (requestId: number) => boolean
  openGiving: () => boolean
  setFlagState: (state: GivingFlagState) => void
  setGivingViewActive: (active: boolean) => void
  handleGivingBack: () => boolean
  registerGivingBackHandler: (handler: () => boolean) => () => void
  handleGivingClose: () => boolean
  registerGivingCloseHandler: (handler: () => boolean) => () => void
}

const disabledContext: GivingExperienceContextValue = {
  flagState: 'failed',
  blinkPayEnabled: false,
  givingSurfaceAvailable: false,
  givingExperience: null,
  givingRequestId: 0,
  givingViewActive: false,
  consumeGivingRequest: () => false,
  openGiving: () => false,
  setFlagState: () => undefined,
  setGivingViewActive: () => undefined,
  handleGivingBack: () => false,
  registerGivingBackHandler: () => () => undefined,
  handleGivingClose: () => false,
  registerGivingCloseHandler: () => () => undefined,
}

const GivingExperienceContext = createContext(disabledContext)

function isOrdinaryGivingClick(event: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>, target: string | null) {
  return event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    (!target || target === '_self')
}

export function GivingExperienceProvider({
  children,
  givingExperience = null,
  serverEligibility,
  resumeRequested = false,
}: {
  children: ReactNode
  givingExperience?: ReactNode
  serverEligibility: GivingServerEligibility
  resumeRequested?: boolean
}) {
  const [flagState, setFlagState] = useState<GivingFlagState>('unresolved')
  const [givingRequestId, setGivingRequestId] = useState(0)
  const [givingViewActive, setGivingViewActive] = useState(false)
  const consumedRequestId = useRef(0)
  const resumedFromCleanUrl = useRef(false)
  const givingBackHandler = useRef<(() => boolean) | null>(null)
  const givingCloseHandler = useRef<(() => boolean) | null>(null)
  const rendererReady = givingExperience !== null
  const givingSurfaceAvailable = rendererReady
  const blinkPayEnabled = serverEligibility !== null && flagState === 'enabled'

  const openGiving = useCallback(() => {
    if (!rendererReady) return false
    setGivingRequestId((requestId) => requestId + 1)
    return true
  }, [rendererReady])

  useEffect(() => {
    if (!rendererReady) return
    const openLocalGivingLink = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      const target = event.target instanceof Element ? event.target.closest('a') : null
      if (!target || target.getAttribute('href') !== '/give' || target.hasAttribute('download')) return
      if (!isOrdinaryGivingClick(event, target.getAttribute('target'))) return
      if (!openGiving()) return
      event.preventDefault()
    }
    document.addEventListener('click', openLocalGivingLink, true)
    return () => document.removeEventListener('click', openLocalGivingLink, true)
  }, [openGiving, rendererReady])

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

  const value = useMemo<GivingExperienceContextValue>(() => ({
    flagState,
    blinkPayEnabled,
    givingSurfaceAvailable,
    givingExperience,
    givingRequestId,
    givingViewActive,
    consumeGivingRequest,
    handleGivingBack,
    handleGivingClose,
    openGiving,
    registerGivingBackHandler,
    registerGivingCloseHandler,
    setFlagState,
    setGivingViewActive,
  }), [
    consumeGivingRequest,
    blinkPayEnabled,
    flagState,
    givingSurfaceAvailable,
    givingExperience,
    givingRequestId,
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
