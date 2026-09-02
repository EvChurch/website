import { describe, expect, it } from 'vitest'

import type { PublicGivingFund } from '@/lib/giving/contracts'
import { createGivingState, givingReducer, nextGivingStep } from './giving-state'

const funds: PublicGivingFund[] = [
  { id: 1, name: 'Community', code: 'COMM', sortOrder: 0, isDefault: false, apprenticeRelated: false },
  { id: 2, name: 'General', code: 'GEN', sortOrder: 1, isDefault: true, apprenticeRelated: false },
]

describe('giving state', () => {
  it('selects the default fund by isDefault and preselects no financial commitment', () => {
    expect(createGivingState(funds)).toMatchObject({
      step: 'amount',
      answers: { fund: funds[1], frequency: null, amountMinor: null, startDate: null },
    })
  })

  it('retains independent answers and clears only an invalid recurring date', () => {
    let state = createGivingState(funds)
    state = givingReducer(state, { type: 'setAmount', amountMinor: 5000 })
    state = givingReducer(state, { type: 'setFrequency', frequency: 'monthly' })
    state = givingReducer(state, { type: 'setStartDate', startDate: '2026-09-01' })
    state = givingReducer(state, { type: 'setIdentity', field: 'email', value: 'giver@example.com' })
    state = givingReducer(state, { type: 'setAmount', amountMinor: 7500 })
    expect(state.answers).toMatchObject({ frequency: 'monthly', startDate: '2026-09-01', email: 'giver@example.com' })

    state = givingReducer(state, { type: 'setFrequency', frequency: 'one-off' })
    expect(state.answers.startDate).toBeNull()
    expect(state.answers.email).toBe('giver@example.com')
    expect(nextGivingStep(state.answers)).toBe('identity-firstName')
  })

  it('edits name fields independently', () => {
    let state = createGivingState(funds)
    state = givingReducer(state, { type: 'setIdentity', field: 'firstName', value: 'Alex' })
    state = givingReducer(state, { type: 'setIdentity', field: 'lastName', value: 'Taylor' })
    state = givingReducer(state, { type: 'edit', step: 'identity-firstName' })
    state = givingReducer(state, { type: 'setIdentity', field: 'firstName', value: 'Alexa' })
    expect(state.answers).toMatchObject({ firstName: 'Alexa', lastName: 'Taylor' })
  })

  it('hydrates only identity fields the person has not edited', () => {
    let state=createGivingState(funds)
    state=givingReducer(state,{type:'setIdentity',field:'firstName',value:'Chosen'})
    state=givingReducer(state,{type:'hydrateIdentity',identity:{firstName:'Rock',lastName:'Member',email:'rock@example.com'},unedited:['lastName','email']})
    expect(state.answers).toMatchObject({firstName:'Chosen',lastName:'Member',email:'rock@example.com'})
    expect(state.missingIdentity).toEqual([])
  })

  it('revalidates an existing date when the recurring period changes', () => {
    let state = createGivingState(funds)
    state = { ...state, answers: { ...state.answers, amountMinor: 1000, frequency: 'monthly', startDate: '2026-08-15' } }
    state = givingReducer(state, { type: 'setFrequency', frequency: 'daily', now: new Date('2026-08-15T10:00:00Z') })
    expect(state.answers.startDate).toBeNull()

    state = { ...state, answers: { ...state.answers, frequency: 'monthly', startDate: '2026-08-16' } }
    state = givingReducer(state, { type: 'setFrequency', frequency: 'weekly', now: new Date('2026-08-15T10:00:00Z') })
    expect(state.answers.startDate).toBe('2026-08-16')
  })

  it('returns an edited amount directly to review while retaining other answers', () => {
    let state = createGivingState(funds, { firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.com' })
    state = {
      ...state,
      step: 'review',
      fundConfirmed: true,
      answers: { ...state.answers, amountMinor: 5000, frequency: 'monthly', startDate: '2026-09-01' },
    }
    state = givingReducer(state, { type: 'edit', step: 'amount', returnTo: 'review' })
    state = givingReducer(state, { type: 'commitAmount', amountMinor: 7500 })
    expect(state.step).toBe('review')
    expect(state.answers).toMatchObject({ amountMinor: 7500, frequency: 'monthly', startDate: '2026-09-01', email: 'alex@example.com' })
  })

  it('moves backward and forward linearly after revisiting completed steps', () => {
    let state = createGivingState(funds, { firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.com' })
    state = {
      ...state,
      step: 'review',
      fundConfirmed: true,
      history: ['amount', 'frequency', 'fund', 'starting-date', 'amount', 'frequency'],
      answers: { ...state.answers, amountMinor: 5000, frequency: 'monthly', startDate: '2026-09-01' },
    }

    state = givingReducer(state, { type: 'back' })
    expect(state.step).toBe('starting-date')
    state = givingReducer(state, { type: 'back' })
    expect(state.step).toBe('fund')
    state = givingReducer(state, { type: 'back' })
    expect(state.step).toBe('frequency')
    state = givingReducer(state, { type: 'back' })
    expect(state.step).toBe('amount')

    state = givingReducer(state, { type: 'commitAmount', amountMinor: 7500 })
    expect(state.step).toBe('frequency')
    state = givingReducer(state, { type: 'setFrequency', frequency: 'monthly' })
    state = givingReducer(state, { type: 'next' })
    expect(state.step).toBe('fund')
  })

  it('requires an explicit fund confirmation while retaining the default selection', () => {
    let state = createGivingState(funds)
    state = givingReducer(state, { type: 'commitAmount', amountMinor: 5000 })
    expect(state.step).toBe('frequency')
    expect(state.answers.fund).toBe(funds[1])
    state = givingReducer(state, { type: 'setFrequency', frequency: 'monthly' })
    state = givingReducer(state, { type: 'next' })
    expect(state.step).toBe('fund')
    state = givingReducer(state, { type: 'setFund', fund: funds[1] })
    state = givingReducer(state, { type: 'next' })
    expect(state.step).toBe('starting-date')
  })

  it('uses the actual missing identity set after restoring a signed-in draft', () => {
    const saved = { ...createGivingState(funds).answers, amountMinor: 5000, frequency: 'monthly' as const, startDate: '2026-09-01', firstName: 'Fresh', lastName: 'Member', email: '' }
    let state = createGivingState(funds)
    state = givingReducer(state, { type: 'restore', answers: saved, missingIdentity: ['email'] })
    expect(state.step).toBe('identity-email')
    state = givingReducer(state, { type: 'restore', answers: { ...saved, email: 'fresh@example.com' }, missingIdentity: [] })
    expect(state.step).toBe('review')
  })
})
