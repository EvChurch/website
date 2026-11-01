'use client'

import { useId, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import { BANK_ACCOUNT_PATTERN, BANK_ACCOUNT_FORMAT_MESSAGE, formatBankAccountNumber, isBankAccountNumber } from '@/lib/bank-account'

type Props = Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange' | 'type' | 'pattern' | 'maxLength'> & {
  value: string
  onValueChange: (value: string) => void
  showValidation?: boolean
}

export function BankAccountInput({ value, onValueChange, showValidation = false, onBlur, ...props }: Props) {
  const errorId = useId()
  const [touched, setTouched] = useState(false)
  const invalid = (touched || showValidation) && !isBankAccountNumber(value)
  const input = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (caret.current !== null) input.current?.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [value])

  function change(raw: string, digitPosition: number) {
    if (!/^[\d\s-]*$/.test(raw) || raw.replace(/\D/g, '').length > 16) return
    const formatted = formatBankAccountNumber(raw)
    let position = 0
    let digits = 0
    while (position < formatted.length && digits < digitPosition) {
      if (/\d/.test(formatted[position])) digits++
      position++
    }
    caret.current = position
    onValueChange(formatted)
  }

  return <><input {...props} ref={input} type="text" inputMode="numeric" autoComplete="off" pattern={BANK_ACCOUNT_PATTERN} title={BANK_ACCOUNT_FORMAT_MESSAGE} value={value}
    aria-invalid={invalid || undefined}
    aria-describedby={[props['aria-describedby'], invalid ? errorId : undefined].filter(Boolean).join(' ') || undefined}
    onBlur={event => { setTouched(true); onBlur?.(event) }}
    onInvalid={event => { event.preventDefault(); setTouched(true); input.current?.focus() }}
    onChange={event => change(event.target.value, event.target.value.slice(0, event.target.selectionStart ?? event.target.value.length).replace(/\D/g, '').length)}
    onKeyDown={event => {
      const field = event.currentTarget
      const position = field.selectionStart ?? 0
      if (position !== field.selectionEnd) return
      // Remove the adjacent digit as well as the inserted separator so deletion never gets stuck on a dash.
      if (event.key === 'Backspace' && position > 0 && value[position - 1] === '-') {
        event.preventDefault()
        change(value.slice(0, position - 2) + value.slice(position), value.slice(0, position - 2).replace(/\D/g, '').length)
      } else if (event.key === 'Delete' && value[position] === '-') {
        event.preventDefault()
        change(value.slice(0, position) + value.slice(position + 2), value.slice(0, position).replace(/\D/g, '').length)
      }
    }}
  />{invalid && <span id={errorId} aria-live="polite" className="mt-1 block text-sm font-normal text-rich-red">{BANK_ACCOUNT_FORMAT_MESSAGE}</span>}</>
}
