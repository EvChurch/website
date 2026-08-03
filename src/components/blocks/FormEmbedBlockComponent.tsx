import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { RockForm } from '@/components/forms/RockForm'

interface FormEmbedBlockProps {
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  rockWorkflowGuid: string
  layout?: 'full' | 'centered' | null
}

export function FormEmbedBlockComponent({
  eyebrow,
  heading,
  description,
  rockWorkflowGuid,
  layout = 'centered',
}: FormEmbedBlockProps) {
  return (
    <section className="bg-warm-white px-5 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-[80rem] px-5 lg:px-8">
        {/* Optional header */}
        {(eyebrow || heading || description) && (
          <ScrollReveal>
            <div className={`mb-12 ${layout === 'centered' ? 'text-center' : ''}`}>
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                  {eyebrow}
                </p>
              )}
              {heading && (
                <h2 className="mt-3 text-h2 leading-heading text-brand-black">
                  {heading}
                </h2>
              )}
              {description && (
                <p
                  className={`mt-4 text-lg leading-relaxed text-dark-grey ${
                    layout === 'centered' ? 'mx-auto max-w-2xl' : 'max-w-2xl'
                  }`}
                >
                  {description}
                </p>
              )}
            </div>
          </ScrollReveal>
        )}

        {/* Form */}
        <ScrollReveal>
          {layout === 'centered' ? (
            <div className="mx-auto max-w-2xl rounded-xl border border-warm-grey/60 bg-white p-8 shadow-sm lg:p-10">
              <RockForm workflowTypeGuid={rockWorkflowGuid} />
            </div>
          ) : (
            <RockForm workflowTypeGuid={rockWorkflowGuid} />
          )}
        </ScrollReveal>
      </div>
    </section>
  )
}
