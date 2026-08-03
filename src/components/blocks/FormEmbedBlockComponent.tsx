import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { RockForm } from '@/components/forms/RockForm'
import { RockConnectionOpportunitySignup } from '@/components/forms/RockConnectionOpportunitySignup'
import type { FormEmbedBlock as PayloadFormEmbedBlock } from '@/payload-types'

type FormEmbedBlockProps = Omit<
  Pick<
    PayloadFormEmbedBlock,
    | 'eyebrow'
    | 'heading'
    | 'description'
    | 'sourceType'
    | 'rockWorkflowGuid'
    | 'rockConnectionBlockGuid'
    | 'layout'
  >,
  'sourceType'
> & {
  // Rows created before the discriminator migration still render as Workflow.
  sourceType?: 'workflow' | 'connectionOpportunity' | null
}

function assertNever(value: never): never {
  throw new Error(`Unsupported form source: ${String(value)}`)
}

function EmbeddedRockForm({
  sourceType,
  rockWorkflowGuid,
  rockConnectionBlockGuid,
}: Pick<
  FormEmbedBlockProps,
  'sourceType' | 'rockWorkflowGuid' | 'rockConnectionBlockGuid'
>) {
  const source = sourceType ?? 'workflow'
  switch (source) {
    case 'workflow':
      return rockWorkflowGuid ? (
        <RockForm workflowTypeGuid={rockWorkflowGuid} />
      ) : (
        <p role="alert">This form is not configured.</p>
      )
    case 'connectionOpportunity':
      return rockConnectionBlockGuid ? (
        <RockConnectionOpportunitySignup blockGuid={rockConnectionBlockGuid} />
      ) : (
        <p role="alert">This signup is not configured.</p>
      )
    default:
      return assertNever(source)
  }
}

export function FormEmbedBlockComponent({
  eyebrow,
  heading,
  description,
  sourceType,
  rockWorkflowGuid,
  rockConnectionBlockGuid,
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

        <ScrollReveal>
          {layout === 'centered' ? (
            <div className="mx-auto max-w-2xl rounded-xl border border-warm-grey/60 bg-white p-8 shadow-sm lg:p-10">
              <EmbeddedRockForm
                sourceType={sourceType}
                rockWorkflowGuid={rockWorkflowGuid}
                rockConnectionBlockGuid={rockConnectionBlockGuid}
              />
            </div>
          ) : (
            <EmbeddedRockForm
              sourceType={sourceType}
              rockWorkflowGuid={rockWorkflowGuid}
              rockConnectionBlockGuid={rockConnectionBlockGuid}
            />
          )}
        </ScrollReveal>
      </div>
    </section>
  )
}
