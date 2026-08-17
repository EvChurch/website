'use client'

import type { RockConnectionSignupAttribute } from '@/lib/rock-connection-signups/types'
import { getConnectionAttributeControl } from '@/lib/rock-connection-signups/field-types'
import { formInputClass, formLabelClass } from './form-styles'
import { FormSelect } from './FormSelect'

export function RockAttributeField({
  attribute,
  value,
  onChange,
}: {
  attribute: RockConnectionSignupAttribute
  value: string
  onChange: (value: string) => void
}) {
  const control = getConnectionAttributeControl(attribute)
  if (!control.available) {
    return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{control.reason}</p>
  }
  const id = `rock-connection-${attribute.attributeGuid}`
  const descriptionId = attribute.description ? `${id}-description` : undefined
  const shared = {
    id,
    className: formInputClass,
    required: attribute.isRequired,
    'aria-describedby': descriptionId,
  }

  let field: React.ReactNode
  if (control.kind === 'memo') {
    field = <textarea {...shared} rows={5} maxLength={control.maxLength} value={value} onChange={(event) => onChange(event.target.value)} />
  } else if (control.kind === 'singleSelect') {
    field = (
      <FormSelect
        id={id}
        required={attribute.isRequired}
        aria-describedby={descriptionId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select…</option>
        {control.options?.map((option) => <option key={option.value} value={option.value}>{option.text}</option>)}
      </FormSelect>
    )
  } else if (control.kind === 'multiSelect') {
    const selected = value ? value.split(',') : []
    field = (
      <fieldset id={id} aria-describedby={descriptionId} className="mt-3 grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">{attribute.name}</legend>
        {control.options?.map((option) => (
          <label key={option.value} className="flex items-start gap-3 text-sm font-normal">
            <input
              className="mt-1 h-4 w-4 accent-rich-red"
              type="checkbox"
              checked={selected.includes(option.value)}
              disabled={!selected.includes(option.value) && selected.length >= 50}
              onChange={(event) => onChange((event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value)).join(','))}
            />
            {option.text}
          </label>
        ))}
        {attribute.isRequired && <input className="sr-only" value={value} required readOnly aria-label={`${attribute.name} selection`} />}
      </fieldset>
    )
  } else if (control.kind === 'boolean') {
    field = (
      <FormSelect
        id={id}
        required={attribute.isRequired}
        aria-describedby={descriptionId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select…</option>
        <option value="True">{attribute.configurationValues.truetext || 'Yes'}</option>
        <option value="False">{attribute.configurationValues.falsetext || 'No'}</option>
      </FormSelect>
    )
  } else {
    const inputType = control.kind === 'integer' || control.kind === 'currency'
      ? 'number'
      : control.kind === 'phone'
        ? 'tel'
        : control.kind
    field = (
      <input
        {...shared}
        type={inputType}
        maxLength={['number', 'date'].includes(inputType) ? undefined : control.maxLength}
        step={control.kind === 'currency' ? '0.01' : control.kind === 'integer' ? '1' : undefined}
        min={control.kind === 'integer' ? -2_147_483_648 : undefined}
        max={control.kind === 'integer' ? 2_147_483_647 : undefined}
        pattern={control.kind === 'url' ? 'https://.*' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <div className="space-y-1">
      <label htmlFor={control.kind === 'multiSelect' ? undefined : id} className={formLabelClass}>
        {attribute.name}{attribute.isRequired && ' *'}
      </label>
      {attribute.description && <p id={descriptionId} className="text-sm text-dark-grey">{attribute.description}</p>}
      {field}
    </div>
  )
}
