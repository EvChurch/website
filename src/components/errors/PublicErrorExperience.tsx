import { Button, type ButtonVariant } from '@/components/ui/Button'

interface PublicErrorAction {
  label: string
  href?: string
  onClick?: () => void
  variant: ButtonVariant
}

interface PublicErrorExperienceProps {
  eyebrow: string
  title: string
  message: string
  actions: PublicErrorAction[]
}

export function PublicErrorExperience({
  eyebrow,
  title,
  message,
  actions,
}: PublicErrorExperienceProps) {
  return (
    <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-2xl py-12 text-center sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-h1 text-brand-black">{title}</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-dark-grey">
          {message}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {actions.map(({ label, href, onClick, variant }) =>
            href ? (
              <Button key={label} href={href} size="large" variant={variant}>
                {label}
              </Button>
            ) : (
              <Button key={label} onClick={onClick} size="large" variant={variant}>
                {label}
              </Button>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
