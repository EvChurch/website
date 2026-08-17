import type { GivingAnswers, GivingStep } from './giving-state'
import { givingStartDateSummary } from './steps/StartingDateStep'

const frequencyLabels: Record<Exclude<GivingAnswers['frequency'], null>, string> = {
  'one-off': 'Just this once',
  daily: 'Every day',
  weekly: 'Every week',
  fortnightly: 'Every two weeks',
  monthly: 'Every month',
  annual: 'Every year',
}

function summary(step: GivingStep, answers: GivingAnswers): { label: string; value: string } | null {
  switch (step) {
    case 'amount': return answers.amountMinor === null ? null : { label: 'amount', value: `I’d like to give $${(answers.amountMinor / 100).toFixed(2)}` }
    case 'fund': return answers.fund ? { label: 'fund', value: `for ${answers.fund.name}` } : null
    case 'frequency': return answers.frequency ? { label: 'frequency', value: frequencyLabels[answers.frequency] } : null
    case 'starting-date': return answers.startDate ? { label: 'starting date', value: `starting ${givingStartDateSummary(answers.startDate)}` } : null
    case 'identity-firstName': return answers.firstName ? { label: 'first name', value: answers.firstName } : null
    case 'identity-lastName': return answers.lastName ? { label: 'last name', value: answers.lastName } : null
    case 'identity-email': return answers.email ? { label: 'email', value: answers.email } : null
    case 'review': return null
  }
}

export function GivingAnswerTrail({ answers, currentStep, visitedSteps, placement, onEdit }: { answers: GivingAnswers; currentStep: GivingStep; visitedSteps: readonly GivingStep[]; placement: 'before' | 'after'; onEdit: (step: GivingStep) => void }) {
  if (currentStep === 'review') return null
  const journey: GivingStep[] = [
    'amount',
    'fund',
    'frequency',
    ...(answers.frequency === 'one-off' ? [] : ['starting-date' as const]),
    'identity-firstName',
    'identity-lastName',
    'identity-email',
    'review',
  ]
  const currentIndex = journey.indexOf(currentStep)
  const visited = new Set(visitedSteps)
  const candidates = placement === 'before'
    ? journey.slice(0, currentIndex)
    : journey.slice(currentIndex + 1)
  const rows = candidates.filter((step) => visited.has(step)).flatMap((step) => {
    const item = summary(step, answers)
    return item ? [{ ...item, step }] : []
  })
  if (rows.length === 0) return null

  return (
    <div className={`${placement === 'before' ? 'mb-5' : 'mt-5'} space-y-3`} aria-label={placement === 'before' ? 'Previous giving choices' : 'Other giving choices'}>
      {rows.map(({ label, value, step }) => (
        <button
          key={step}
          type="button"
          onClick={() => onEdit(step)}
          aria-label={`Change ${label}`}
          data-giving-answer
          className="group relative flex min-h-14 w-full animate-fade-in-up items-center rounded-full bg-white px-5 pr-24 text-left font-semibold text-dark-grey shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red motion-reduce:animate-none motion-reduce:transform-none"
        >
          <span className="truncate">{value}</span>
          <span className="absolute right-5 text-sm font-semibold text-rich-red opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:opacity-0">Change</span>
        </button>
      ))}
    </div>
  )
}
