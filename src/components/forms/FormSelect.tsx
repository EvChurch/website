import type { ComponentPropsWithoutRef } from 'react'
import { HiChevronDown } from 'react-icons/hi2'

import { formInputClass } from './form-styles'

export function FormSelect({ className = '', children, ...props }: ComponentPropsWithoutRef<'select'>) {
  return (
    <span className="relative block" data-form-select="true">
      <select
        {...props}
        className={`${formInputClass} appearance-none pr-11 ${className}`.trim()}
      >
        {children}
      </select>
      <HiChevronDown
        className="pointer-events-none absolute top-[calc(50%+0.25rem)] right-4 h-5 w-5 -translate-y-1/2 text-rich-red"
        aria-hidden="true"
      />
    </span>
  )
}
