import type { ComponentPropsWithoutRef } from 'react'
import { HiChevronDown } from 'react-icons/hi2'

import { formInputClass } from './form-styles'

export function FormSelect({ className = '', children, variant = 'default', ...props }: ComponentPropsWithoutRef<'select'> & { variant?: 'default' | 'cell' }) {
  return (
    <span className="relative block" data-form-select="true">
      <select
        {...props}
        className={`${variant === 'cell' ? 'w-full appearance-none pr-6' : `${formInputClass} appearance-none pr-11`} ${className}`.trim()}
      >
        {children}
      </select>
      {!(variant === 'cell' && props.disabled) && <HiChevronDown
        className={`pointer-events-none absolute -translate-y-1/2 text-rich-red ${variant === 'cell' ? 'right-1 top-1/2 h-4 w-4' : 'top-[calc(50%+0.25rem)] right-4 h-5 w-5'}`}
        aria-hidden="true"
      />}
    </span>
  )
}
