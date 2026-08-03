'use client'

import { SelectInput, useField } from '@payloadcms/ui'
import { useEffect, useMemo, useState } from 'react'
import type { OptionObject, TextFieldClientComponent } from 'payload'
import type { RockWorkflowOption } from '@/lib/rock-forms/types'

type RockFormOption = Pick<RockWorkflowOption, 'guid' | 'name'>
type RockFormsListResponse = { forms?: RockFormOption[]; error?: string }

let formsRequest: Promise<RockFormOption[]> | null = null

function loadForms() {
  formsRequest ||= fetch('/api/rock-forms').then(async (response) => {
    const data = (await response.json()) as RockFormsListResponse
    if (!response.ok) throw new Error(data.error || 'Unable to load forms')
    return data.forms || []
  })
  return formsRequest
}

export const RockWorkflowPicker: TextFieldClientComponent = ({ field, path }) => {
  const { value, setValue, showError } = useField<string>({ path })
  const [forms, setForms] = useState<RockFormOption[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadForms()
      .then((loadedForms) => {
        if (active) setForms(loadedForms)
      })
      .catch((caught) => {
        formsRequest = null
        if (active) setError(caught.message)
      })

    return () => {
      active = false
    }
  }, [])

  const options = useMemo<OptionObject[]>(
    () => forms.map((form) => ({ label: form.name, value: form.guid })),
    [forms],
  )

  return (
    <div>
      <SelectInput
        name={path}
        path={path}
        label={field.label || 'Rock form'}
        description={field.admin?.description}
        options={options}
        value={value || ''}
        required={field.required}
        showError={showError}
        isClearable
        placeholder={forms.length ? 'Search Rock forms…' : 'Loading Rock forms…'}
        onChange={(selection) => {
          const option = Array.isArray(selection) ? selection[0] : selection
          setValue(typeof option?.value === 'string' ? option.value : null)
        }}
      />
      {error && <p style={{ color: 'var(--theme-error-500)' }}>{error}</p>}
    </div>
  )
}
