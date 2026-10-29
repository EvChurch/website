'use client'
import { SelectInput, useField } from '@payloadcms/ui'
import type { JSONFieldClientComponent } from 'payload'
import { scopes, scopeLabels, type ApiScope } from '@/lib/api/contract'
export const ApiKeyPermissions: JSONFieldClientComponent = ({path}) => {
  const {value, setValue, showError} = useField<ApiScope[]>({path})
  return <SelectInput name={path} path={path} label="Permissions" hasMany required showError={showError}
    options={scopes.map(value => ({value, label:scopeLabels[value]}))} value={value ?? []}
    onChange={options => setValue(Array.isArray(options) ? options.map(option => option.value) : [])} />
}
