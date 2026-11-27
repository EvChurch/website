import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HiChevronDown } from 'react-icons/hi2'
import {
  GIVING_FREQUENCIES,
  type GivingFrequency,
} from '@/lib/generosity/calculator'

const incomeFrequencies = { hourly: { label: 'Hourly' }, ...GIVING_FREQUENCIES }

export function CalculatorFrequency<
  T extends GivingFrequency | 'hourly' = GivingFrequency,
>({
  id,
  label,
  value,
  onChange,
  hourly = false,
}: {
  id?: string
  label: string
  value: T
  onChange: (value: T) => void
  hourly?: boolean
}) {
  const options = Object.entries(
    hourly ? incomeFrequencies : GIVING_FREQUENCIES,
  )
  const menuId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  function open() {
    const rect = trigger.current!.getBoundingClientRect()
    const height = hourly ? 236 : 196
    setPosition({
      left: Math.max(
        8,
        Math.min(rect.left, window.innerWidth - Math.max(rect.width, 150) - 8),
      ),
      top:
        window.innerHeight - rect.bottom > height
          ? rect.bottom + 6
          : Math.max(8, rect.top - height),
      width: Math.max(rect.width, 150),
    })
  }
  function close() {
    setPosition(null)
    trigger.current?.focus()
  }
  const isOpen = position !== null
  useEffect(() => {
    if (!isOpen) return
    menu.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.focus({ preventScroll: true })
    function outside(event: PointerEvent) {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setPosition(null)
    }
    function dismiss() {
      setPosition(null)
    }
    function reposition() {
      const rect = trigger.current!.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) dismiss()
      else open()
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', dismiss)
    document.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', dismiss)
      document.removeEventListener('scroll', reposition, true)
    }
  }, [isOpen])
  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={position !== null}
        aria-controls={position ? menuId : undefined}
        onClick={() => (position ? close() : open())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            open()
          }
        }}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-warm-grey/70 bg-white px-3 py-3 text-left text-base text-brand-black shadow-sm transition hover:border-rich-red/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red"
      >
        {incomeFrequencies[value].label}
        <HiChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-rich-red transition ${position ? 'rotate-180' : ''}`}
        />
      </button>
      {position &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="listbox"
            aria-label={label}
            style={position}
            className="fixed z-[100] rounded-xl border border-warm-grey/70 bg-white p-2 shadow-lg"
            onKeyDown={(event) => {
              const buttons = Array.from(
                menu.current!.querySelectorAll<HTMLButtonElement>(
                  '[role="option"]',
                ),
              )
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              )
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                close()
              }
              if (event.key === 'Tab') close()
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault()
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? buttons.length - 1
                      : (index +
                          (event.key === 'ArrowDown' ? 1 : -1) +
                          buttons.length) %
                        buttons.length
                buttons[next].focus({ preventScroll: true })
              }
            }}
          >
            {options.map(([frequency, item]) => (
              <button
                key={frequency}
                type="button"
                role="option"
                aria-selected={value === frequency}
                tabIndex={value === frequency ? 0 : -1}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-base hover:bg-warm-white focus:bg-warm-white focus:outline-none ${value === frequency ? 'font-semibold text-rich-red' : 'font-medium text-brand-black'}`}
                onClick={() => {
                  onChange(frequency as T)
                  close()
                }}
              >
                {item.label}
                {value === frequency && (
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-rich-red"
                  />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
