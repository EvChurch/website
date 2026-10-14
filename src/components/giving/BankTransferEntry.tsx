'use client'

import { useEffect, useRef } from 'react'

import { OpenGivingButton } from './OpenGivingButton'
import { useGivingExperience } from './GivingExperienceProvider'

export function BankTransferEntry() {
  const { openGiving } = useGivingExperience()
  const opened = useRef(false)

  useEffect(() => {
    if (!opened.current) opened.current = openGiving()
  }, [openGiving])

  return <OpenGivingButton />
}
