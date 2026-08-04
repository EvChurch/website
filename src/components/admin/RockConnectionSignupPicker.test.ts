import { describe, expect, it } from 'vitest'

import { deriveConnectionPickerState } from './RockConnectionSignupPicker.state'

const options = [
  { blockGuid: '70f9eb00-5961-42bc-b1ea-dbcb8fce6369', label: 'Newish — proxy' },
]

describe('Rock Connection Signup picker state', () => {
  it('distinguishes loading, retryable error, and no eligible configurations', () => {
    expect(deriveConnectionPickerState({ loading: true, error: '', options: [], value: '', query: '' }).kind).toBe('loading')
    expect(deriveConnectionPickerState({ loading: false, error: 'Offline', options: [], value: '', query: '' })).toEqual({ kind: 'error', message: 'Offline' })
    expect(deriveConnectionPickerState({ loading: false, error: '', options: [], value: '', query: '' }).kind).toBe('empty')
  })

  it('distinguishes no search match from an eligible result', () => {
    expect(deriveConnectionPickerState({ loading: false, error: '', options, value: '', query: 'missing' }).kind).toBe('noMatch')
    expect(deriveConnectionPickerState({ loading: false, error: '', options, value: '', query: 'new' }).kind).toBe('ready')
  })

  it('preserves a saved now-ineligible GUID as a blocking warning', () => {
    expect(deriveConnectionPickerState({
      loading: false,
      error: '',
      options,
      value: '99999999-9999-4999-8999-999999999999',
      query: '',
    })).toEqual({
      kind: 'ineligible',
      value: '99999999-9999-4999-8999-999999999999',
    })
  })
})
