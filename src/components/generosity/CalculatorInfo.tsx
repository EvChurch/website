import { useEffect, useId, useRef, useState } from 'react'
import { HiInformationCircle } from 'react-icons/hi2'

export function CalculatorInfo({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [left, setLeft] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()
  function show() {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(256, window.innerWidth - 16)
      setLeft(
        Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) -
          rect.left,
      )
    }
    setOpen(true)
  }
  useEffect(() => {
    if (!open) return
    function dismiss(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <span
      ref={ref}
      className="relative inline-flex shrink-0 items-center"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') show()
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setOpen(false)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        type="button"
        aria-label={`About ${name}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={show}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) show()
        }}
        className="inline-flex size-7 items-center justify-center rounded-full text-mid-grey hover:text-rich-red focus-visible:outline-2 focus-visible:outline-rich-red"
      >
        <HiInformationCircle aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <span
          style={{ left }}
          className="absolute top-full z-20 w-64 max-w-[calc(100vw-1rem)] pt-2"
        >
          <span
            id={id}
            role="tooltip"
            className="block rounded-lg border border-warm-grey bg-white p-3 text-sm font-normal text-brand-black shadow-lg"
          >
            {children}
          </span>
        </span>
      )}
    </span>
  )
}
