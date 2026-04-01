'use client'

import { useState, useCallback } from 'react'

interface AccordionItem {
  question: string
  answer: unknown // Lexical rich text state
  id?: string
}

interface AccordionBlockProps {
  heading?: string | null
  items: AccordionItem[]
  allowMultiple?: boolean | null
}

function AccordionRow({
  item,
  isOpen,
  onToggle,
}: {
  item: AccordionItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-warm-grey">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-rich-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2"
      >
        <span className="text-lg font-semibold text-brand-black">{item.question}</span>
        <svg
          className={`h-5 w-5 shrink-0 text-mid-grey transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* CSS grid-rows trick for smooth expand/collapse */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pb-6 pr-12 text-dark-grey leading-[var(--leading-body)]">
            <p className="text-[0.9375rem] leading-relaxed text-dark-grey">
              {typeof item.answer === 'string' ? item.answer : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AccordionBlockComponent({
  heading,
  items,
  allowMultiple = false,
}: AccordionBlockProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())

  const toggle = useCallback(
    (index: number) => {
      setOpenItems((prev) => {
        const next = new Set(allowMultiple ? prev : [])
        if (prev.has(index)) {
          next.delete(index)
        } else {
          next.add(index)
        }
        return next
      })
    },
    [allowMultiple],
  )

  return (
    <section className="bg-white px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-3xl">
        {heading && (
          <h2 className="mb-10 text-center text-h2 leading-heading text-brand-black">
            {heading}
          </h2>
        )}

        <div className="border-t border-warm-grey">
          {items.map((item, index) => (
            <AccordionRow
              key={item.id ?? index}
              item={item}
              isOpen={openItems.has(index)}
              onToggle={() => toggle(index)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
