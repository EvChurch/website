'use client'

import { SelectInput, useField } from '@payloadcms/ui'
import { useEffect, useMemo, useState } from 'react'
import type { OptionObject, TextFieldClientComponent } from 'payload'
import {
  deriveConnectionPickerState,
  type ConnectionOption,
} from './RockConnectionSignupPicker.state'
type ConnectionsResponse = { configurations?: ConnectionOption[]; error?: string }

let configurationsRequest: Promise<ConnectionOption[]> | null = null

function loadConfigurations() {
  configurationsRequest ||= fetch('/api/admin/rock-connection-signups', {
    credentials: 'same-origin',
  }).then(async (response) => {
    const data = (await response.json()) as ConnectionsResponse
    if (!response.ok) throw new Error(data.error || 'Unable to load Connection Signup configurations')
    return data.configurations || []
  })
  return configurationsRequest
}

export const RockConnectionSignupPicker: TextFieldClientComponent = ({
  field,
  path,
}) => {
  const [configurations, setConfigurations] = useState<ConnectionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const { value, setValue, showError } = useField<string>({
    path,
    validate: (currentValue) => {
      if (loading) return 'Wait for eligible Rock Connection Signup configurations to load.'
      if (error) return 'Unable to verify this Rock Connection Signup. Retry discovery before publishing.'
      if (!currentValue) return 'Choose an eligible Rock Connection Signup configuration.'
      const normalizedCurrentValue = String(currentValue).toLowerCase()
      if (!configurations.some(({ blockGuid }) => blockGuid.toLowerCase() === normalizedCurrentValue)) {
        return 'This saved Rock Connection Signup is no longer eligible. Choose a replacement before publishing.'
      }
      return true
    },
  })

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    loadConfigurations()
      .then((loaded) => {
        if (active) setConfigurations(loaded)
      })
      .catch((caught) => {
        configurationsRequest = null
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load Connection Signup configurations')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [requestVersion])

  const normalizedValue = typeof value === 'string' ? value.toLowerCase() : ''
  const state = deriveConnectionPickerState({
    loading,
    error,
    options: configurations,
    value: normalizedValue,
    query,
  })
  const options = useMemo<OptionObject[]>(() => {
    const eligible: OptionObject[] = configurations.map((configuration) => ({
      label: configuration.label,
      value: configuration.blockGuid,
    }))
    if (normalizedValue && !configurations.some(({ blockGuid }) => blockGuid === normalizedValue)) {
      eligible.unshift({
        label: `Saved configuration ${normalizedValue} — no longer eligible`,
        value: normalizedValue,
        isDisabled: true,
      } as OptionObject)
    }
    return eligible
  }, [configurations, normalizedValue])

  const retry = () => {
    configurationsRequest = null
    setRequestVersion((version) => version + 1)
  }

  return (
    <div>
      <SelectInput
        name={path}
        path={path}
        label={field.label || 'Rock Connection Signup'}
        description={field.admin?.description}
        options={options}
        value={normalizedValue}
        required
        readOnly={state.kind === 'loading' || state.kind === 'error' || state.kind === 'empty'}
        showError={showError || state.kind === 'ineligible'}
        isClearable
        placeholder={state.kind === 'loading' ? 'Loading eligible configurations…' : 'Search eligible configurations…'}
        onInputChange={setQuery}
        onChange={(selection) => {
          const option = Array.isArray(selection) ? selection[0] : selection
          const nextValue = typeof option?.value === 'string' ? option.value : null
          if (nextValue !== normalizedValue || state.kind !== 'ineligible') setValue(nextValue)
        }}
      />
      {state.kind === 'loading' && <p>Loading eligible Connection Signup configurations…</p>}
      {state.kind === 'empty' && <p>No eligible Connection Signup configurations are available. Ask a Rock administrator to configure one.</p>}
      {state.kind === 'noMatch' && <p>No eligible configurations match your search.</p>}
      {state.kind === 'ineligible' && (
        <p style={{ color: 'var(--theme-error-500)' }}>
          The saved configuration {state.value} is no longer eligible. Choose a replacement before publishing.
        </p>
      )}
      {state.kind === 'error' && (
        <div>
          <p style={{ color: 'var(--theme-error-500)' }}>{state.message}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      )}
    </div>
  )
}
