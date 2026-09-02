import type { PublicGivingFund } from '@/lib/giving/contracts'
import type { GivingFrequency } from '@/lib/giving/blinkpay/types'
import { isGivingStartDateValid } from './steps/StartingDateStep'

export type { GivingFrequency } from '@/lib/giving/blinkpay/types'
export type GivingIdentityField = 'firstName' | 'lastName' | 'email'
export type GivingStep =
  | 'amount'
  | 'fund'
  | 'frequency'
  | 'starting-date'
  | 'identity-firstName'
  | 'identity-lastName'
  | 'identity-email'
  | 'review'

export interface GivingAnswers {
  amountMinor: number | null
  fund: PublicGivingFund | null
  frequency: GivingFrequency | null
  startDate: string | null
  firstName: string
  lastName: string
  email: string
}

export interface GivingState {
  step: GivingStep
  answers: GivingAnswers
  history: GivingStep[]
  editReturnStep: GivingStep | null
  linearNavigation: boolean
  missingIdentity: GivingIdentityField[]
  fundConfirmed: boolean
}

export type GivingAction =
  | { type: 'setAmount'; amountMinor: number }
  | { type: 'setFund'; fund: PublicGivingFund }
  | { type: 'setFrequency'; frequency: GivingFrequency; now?: Date }
  | { type: 'setStartDate'; startDate: string }
  | { type: 'setIdentity'; field: GivingIdentityField; value: string }
  | { type: 'hydrateIdentity'; identity: Partial<Record<GivingIdentityField, string>>; unedited: readonly GivingIdentityField[] }
  | { type: 'commitAmount'; amountMinor: number }
  | { type: 'next'; missingIdentity?: readonly GivingIdentityField[] }
  | { type: 'back' }
  | { type: 'edit'; step: GivingStep; returnTo?: GivingStep }
  | { type: 'restore'; answers: GivingAnswers; fundConfirmed: boolean; missingIdentity?: GivingIdentityField[] }
  | { type: 'reset'; funds: readonly PublicGivingFund[]; identity?: Partial<Record<GivingIdentityField, string>> }

export function createGivingState(
  funds: readonly PublicGivingFund[],
  identity: Partial<Record<GivingIdentityField, string>> = {},
): GivingState {
  return {
    step: 'amount',
    history: [],
    editReturnStep: null,
    linearNavigation: false,
    fundConfirmed: false,
    missingIdentity: (['firstName', 'lastName', 'email'] as const).filter((field) => !identity[field]),
    answers: {
      amountMinor: null,
      fund: funds.find((fund) => fund.isDefault) ?? null,
      frequency: null,
      startDate: null,
      firstName: identity.firstName ?? '',
      lastName: identity.lastName ?? '',
      email: identity.email ?? '',
    },
  }
}

export function nextGivingStep(
  answers: GivingAnswers,
  missingIdentity: readonly GivingIdentityField[] = ['firstName', 'lastName', 'email'],
  fundConfirmed = true,
): GivingStep {
  if (answers.amountMinor === null) return 'amount'
  if (answers.frequency === null) return 'frequency'
  if (answers.fund === null || !fundConfirmed) return 'fund'
  if (answers.frequency !== 'one-off' && answers.startDate === null) return 'starting-date'
  for (const field of missingIdentity) {
    if (!answers[field].trim()) return `identity-${field}`
  }
  return 'review'
}

export function givingStepOrder(answers: GivingAnswers): GivingStep[] {
  return [
    'amount',
    'frequency',
    'fund',
    ...(answers.frequency === 'one-off' ? [] : ['starting-date' as const]),
    'identity-firstName',
    'identity-lastName',
    'identity-email',
    'review',
  ]
}

function move(state: GivingState, step: GivingStep): GivingState {
  if (step === state.step) return state
  return { ...state, step, history: state.history.includes(state.step) ? state.history : [...state.history, state.step] }
}

function givingJourney(state: GivingState): GivingStep[] {
  const identitySteps = new Set<GivingStep>([
    ...state.missingIdentity.map((field) => `identity-${field}` as const),
    ...state.history.filter((step) => step.startsWith('identity-')),
    ...(state.step.startsWith('identity-') ? [state.step] : []),
  ])
  return givingStepOrder(state.answers).filter((step) => !step.startsWith('identity-') || identitySteps.has(step))
}

function adjacentGivingStep(state: GivingState, offset: -1 | 1): GivingStep | null {
  const journey = givingJourney(state)
  const index = journey.indexOf(state.step)
  return journey[index + offset] ?? null
}

export function previousGivingStep(state: GivingState): GivingStep | null {
  return adjacentGivingStep(state, -1)
}

export function givingReducer(state: GivingState, action: GivingAction): GivingState {
  switch (action.type) {
    case 'setAmount':
      return { ...state, answers: { ...state.answers, amountMinor: action.amountMinor } }
    case 'setFund':
      return { ...state, fundConfirmed: true, answers: { ...state.answers, fund: action.fund } }
    case 'setFrequency':
      const retainedDate = action.frequency !== 'one-off' && state.answers.startDate && state.answers.amountMinor &&
        isGivingStartDateValid(action.frequency, state.answers.amountMinor, state.answers.startDate, action.now)
        ? state.answers.startDate
        : null
      return {
        ...state,
        answers: {
          ...state.answers,
          frequency: action.frequency,
          startDate: retainedDate,
        },
      }
    case 'setStartDate':
      return { ...state, answers: { ...state.answers, startDate: action.startDate } }
    case 'setIdentity':
      return { ...state, answers: { ...state.answers, [action.field]: action.value } }
    case 'hydrateIdentity': {
      const answers = { ...state.answers }
      for (const field of action.unedited) {
        const value = action.identity[field]
        if (value) answers[field] = value
      }
      return { ...state, answers, missingIdentity: (['firstName','lastName','email'] as const).filter((field) => !answers[field].trim()) }
    }
    case 'commitAmount': {
      const answers = { ...state.answers, amountMinor: action.amountMinor }
      const required = state.linearNavigation ? 'frequency' : nextGivingStep(answers, state.missingIdentity, state.fundConfirmed)
      const step = state.editReturnStep && required === 'review' ? state.editReturnStep : required
      return {
        ...move({ ...state, answers }, step),
        editReturnStep: step === state.editReturnStep ? null : state.editReturnStep,
        linearNavigation: state.linearNavigation && step !== 'review',
      }
    }
    case 'next': {
      const required = state.linearNavigation
        ? adjacentGivingStep(state, 1) ?? 'review'
        : nextGivingStep(state.answers, action.missingIdentity ?? state.missingIdentity, state.fundConfirmed)
      const step = state.editReturnStep && required === 'review' ? state.editReturnStep : required
      const moved = move(state, step)
      return {
        ...moved,
        editReturnStep: step === state.editReturnStep ? null : state.editReturnStep,
        linearNavigation: state.linearNavigation && step !== 'review',
      }
    }
    case 'edit':
      return { ...move(state, action.step), editReturnStep: action.returnTo ?? state.editReturnStep, linearNavigation: false }
    case 'back': {
      const step = previousGivingStep(state)
      return step ? { ...move(state, step), editReturnStep: null, linearNavigation: true } : state
    }
    case 'restore':
      const restoredIdentity = action.missingIdentity ?? state.missingIdentity
      const restoredStep = nextGivingStep(action.answers, restoredIdentity, action.fundConfirmed)
      const restoredOrder = givingStepOrder(action.answers)
      return {
        step: restoredStep,
        answers: action.answers,
        history: restoredOrder.slice(0, restoredOrder.indexOf(restoredStep)).filter((step) =>
          !step.startsWith('identity-') || restoredIdentity.includes(step.replace('identity-', '') as GivingIdentityField)),
        editReturnStep: null,
        linearNavigation: false,
        fundConfirmed: action.fundConfirmed,
        missingIdentity: restoredIdentity,
      }
    case 'reset':
      return createGivingState(action.funds, action.identity)
  }
}

export function draftAnswers(answers: GivingAnswers, fundConfirmed: boolean) {
  if (answers.amountMinor === null) return null
  return {
    amountMinor: answers.amountMinor,
    fundId: fundConfirmed ? answers.fund?.id ?? null : null,
    fundConfirmed: fundConfirmed && answers.fund !== null,
    frequency: answers.frequency,
    startDate: answers.startDate,
    firstName: answers.firstName,
    lastName: answers.lastName,
    email: answers.email,
  }
}
