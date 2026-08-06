import Link from 'next/link'
import { forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'text'
type Size = 'default' | 'large'

type BaseProps = {
  variant?: ButtonVariant
  size?: Size
  className?: string
  children: React.ReactNode
}

type ButtonAsLink = BaseProps & {
  href: string
  external?: boolean
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps>

export type ButtonLinkAction = Pick<
  ButtonAsLink,
  'href' | 'external' | 'variant'
> & {
  label: string
}

type ButtonAsButton = BaseProps & {
  href?: never
  external?: never
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps>

export type ButtonProps = ButtonAsLink | ButtonAsButton

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-rich-red text-white hover:bg-deep-red shadow-sm hover:shadow-md focus-visible:ring-rich-red',
  secondary:
    'border-2 border-rich-red text-rich-red hover:bg-rich-red hover:text-white focus-visible:ring-rich-red',
  text: 'text-rich-red hover:text-deep-red focus-visible:ring-rich-red group',
}

const sizeStyles: Record<Size, string> = {
  default: 'px-6 py-2.5 text-sm',
  large: 'px-8 py-3.5 text-base',
}

function buildClassName(variant: ButtonVariant, size: Size, extra?: string) {
  const base =
    'inline-flex items-center justify-center gap-2 cursor-pointer font-semibold rounded-md transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
  const parts = [base, variantStyles[variant]]
  if (variant !== 'text') parts.push(sizeStyles[size])
  if (extra) parts.push(extra)
  return parts.join(' ')
}

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(function Button(props, ref) {
  const {
    variant = 'primary',
    size = 'default',
    className,
    children,
    ...rest
  } = props

  const classes = buildClassName(variant, size, className)

  if ('href' in props && props.href) {
    const { href, external } = props as ButtonAsLink
    if (external || href.startsWith('http')) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {children}
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      )
    }
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        className={classes}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={classes}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  )
})

/** Arrow icon for text-variant buttons */
export function ArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`${className} transition-transform duration-200 group-hover:translate-x-1`}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 01.75-.75h10.638l-3.96-4.158a.75.75 0 111.08-1.04l5.25 5.5a.75.75 0 010 1.04l-5.25 5.5a.75.75 0 11-1.08-1.04l3.96-4.158H3.75A.75.75 0 013 10z"
        clipRule="evenodd"
      />
    </svg>
  )
}
