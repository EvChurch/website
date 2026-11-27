'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FiTrash2 } from 'react-icons/fi'

const money = (minor: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100)

export function giftAmountMinor(value: string): number | null {
  if (!/^\d+$/u.test(value.trim())) return null
  const amount = Number(value.trim()) * 100
  return Number.isSafeInteger(amount) && amount >= 100 && amount <= 99_999_900 ? amount : null
}

export function GiftAmountDialog({ title, suggestions, currentAmount, onConfirm, onClose, onRemove }: {
  title: string
  suggestions: readonly number[]
  currentAmount?: number
  onConfirm(amountMinor: number): void
  onClose(): void
  onRemove?(): void
}) {
  const editing = Boolean(onRemove)
  const dialog = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(currentAmount && currentAmount % 100 === 0 ? String(currentAmount / 100) : '')
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current!
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => { element.close(); document.body.style.overflow = overflow }
  }, [])
  function submit(event: FormEvent) {
    event.preventDefault()
    const amount = giftAmountMinor(value)
    if (amount === null) { setError('Enter a whole-dollar amount from $1 to $999,999.'); return }
    onConfirm(amount)
  }
  return <dialog ref={dialog} aria-labelledby="gift-amount-title"
    onCancel={onClose} onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl bg-warm-white p-6 text-brand-black shadow-2xl backdrop:bg-brand-black/70 sm:p-8">
    <form onSubmit={submit} noValidate>
      <div className="flex items-start justify-between gap-4">
        <h2 id="gift-amount-title" className="text-2xl font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close gift amount dialog" className="rounded-full px-2 py-1 text-xl">×</button>
      </div>
      {suggestions.length > 0 && <>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {suggestions.map(amount => <button key={amount} type="button" aria-pressed={selected === amount}
            onClick={() => { setValue(String(amount / 100)); setSelected(amount); setError('') }}
            className={`rounded-xl border px-3 py-3 font-semibold ${selected === amount ? 'border-rich-red bg-rich-red text-white' : 'border-warm-grey bg-white hover:border-rich-red'}`}>{money(amount)}</button>)}
        </div>
      </>}
      <label htmlFor="gift-custom-amount" className="mt-6 block text-sm font-semibold">{suggestions.length ? 'Or enter your own amount' : 'Your gift amount'}</label>
      <div className="relative mt-2">
        <span aria-hidden="true" className="absolute left-4 top-3 text-mid-grey">$</span>
        <input id="gift-custom-amount" autoFocus type="text" inputMode="numeric" pattern="[0-9]*" value={value} maxLength={6}
          onKeyDown={event => { if (!event.ctrlKey && !event.metaKey && event.key.length === 1 && !/^\d$/u.test(event.key)) event.preventDefault() }}
          onChange={event => { if (!/^\d*$/u.test(event.target.value)) return; setValue(event.target.value); setSelected(null); setError('') }}
          aria-invalid={Boolean(error)} aria-describedby={error ? 'gift-amount-error' : undefined}
          className="w-full rounded-xl border border-warm-grey bg-white py-3 pl-8 pr-4" placeholder="0" />
      </div>
      {error && <p id="gift-amount-error" role="alert" className="mt-3 text-sm text-rich-red">{error}</p>}
      <div className="mt-8 flex flex-wrap justify-end gap-3">
        {editing && <button type="button" onClick={onRemove} aria-label="Remove gift" title="Remove gift"
          className="mr-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-rich-red transition-colors hover:bg-rich-red/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rich-red">
          <FiTrash2 aria-hidden="true" className="h-5 w-5" />
        </button>}
        <button type="button" onClick={onClose} className="rounded-full border border-warm-grey px-6 py-3 text-sm font-semibold">Cancel</button>
        <button type="submit" className="rounded-full bg-rich-red px-6 py-3 text-sm font-semibold text-white">{editing ? 'Update Gift' : 'Add gift to cart'}</button>
      </div>
    </form>
  </dialog>
}
