import { useEffect, useRef, useState } from 'react'
import { HiArrowRight } from 'react-icons/hi2'

import type { GivingIdentityField } from '../giving-state'

const labels: Record<GivingIdentityField, string> = { firstName: 'First name', lastName: 'Last name', email: 'Email' }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

export function isGivingIdentityValueValid(field: GivingIdentityField, value: string) {
  const normalized = value.trim()
  if (!normalized) return false
  return field !== 'email' || (normalized.length <= 320 && EMAIL_PATTERN.test(normalized))
}

export function IdentityStep({ field, value, onChange, onContinue }: { field: GivingIdentityField; value: string; onChange: (value: string) => void; onContinue: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [showError, setShowError] = useState(false)
  const canContinue = value.trim().length > 0

  useEffect(() => {
    input.current?.focus({ preventScroll: true })
    setShowError(false)
  }, [field])

  const submit = () => {
    if (!isGivingIdentityValueValid(field, value)) {
      setShowError(true)
      input.current?.focus({ preventScroll: true })
      return
    }
    onContinue()
  }

  return (
    <form noValidate onSubmit={(event) => { event.preventDefault(); submit() }}>
      <label className="block">
        <span className="sr-only">{labels[field]}</span>
        <div className={`flex min-h-20 items-center rounded-[1.75rem] bg-white px-5 shadow-sm ring-1 transition focus-within:ring-2 ${showError ? 'ring-rich-red' : 'ring-warm-grey/70 focus-within:ring-rich-red'}`}>
          <input
            aria-describedby={showError ? 'giving-identity-error' : undefined}
            aria-invalid={showError || undefined}
            autoCapitalize={field === 'email' ? 'none' : 'words'}
            autoComplete={field === 'email' ? 'email' : field === 'firstName' ? 'given-name' : 'family-name'}
            autoFocus
            className="min-w-0 flex-1 bg-transparent pr-3 text-2xl font-semibold text-brand-black outline-none"
            inputMode={field === 'email' ? 'email' : 'text'}
            onChange={(event) => { setShowError(false); onChange(event.target.value) }}
            ref={input}
            spellCheck={field !== 'email'}
            type="text"
            value={value}
          />
          {canContinue && (
            <button aria-label="Continue" className="flex h-12 w-12 shrink-0 animate-scale-in items-center justify-center rounded-full bg-rich-red text-white shadow-sm transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2 motion-reduce:animate-none" type="submit">
              <HiArrowRight aria-hidden="true" className="h-6 w-6" />
              <span className="sr-only">Continue</span>
            </button>
          )}
        </div>
      </label>
      {showError && field === 'email' && <p className="mt-3 text-sm font-medium text-rich-red" id="giving-identity-error" role="alert">Enter a valid email address.</p>}
    </form>
  )
}
