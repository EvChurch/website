'use client'

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { SafeRockHtml } from './SafeRockHtml'
import { FormSelect } from './FormSelect'
import { CalendarDatePicker } from './CalendarDatePicker'
import { TurnstileWidget } from './TurnstileWidget'
import { formInputClass as inputClass, formLabelClass as labelClass } from './form-styles'
import {
  parseRockOptions,
  ROCK_FIELD_TYPES,
} from '@/lib/rock-forms/field-types'
import {
  ROCK_FORM_START_ACTION,
  ROCK_FORM_SUBMIT_ACTION,
} from '@/lib/rock-forms/constants'
import { defaultPersonEntryValues, parseJson } from '@/lib/rock-forms/schema'
import {
  isCompleteResponse,
  isRockFormSchema,
  readJsonResponse,
  type FormStartResponse,
  type FormSubmitResponse,
} from '@/lib/rock-forms/response'
import { isRockRuleVisible } from '@/lib/rock-forms/visibility'
import { Button } from '@/components/ui/Button'
import {
  DEFAULT_FORM_FALLBACK_ACTION,
  type FormFallbackAction,
} from '@/lib/form-fallback'
import { trackSuccessfulFormSubmission } from '@/lib/analytics'
import type {
  RockFormField,
  RockFormSchema,
  RockListItem,
  RockPersonBasicValues,
  RockPersonEntryConfiguration,
  RockPersonEntryValues,
} from '@/lib/rock-forms/types'

const FORM_STARTUP_ERROR = 'This form is temporarily unavailable.'
const fieldColumnClasses: Record<number, string> = {
  1: 'col-span-12 @md/rock-form:col-span-1',
  2: 'col-span-12 @md/rock-form:col-span-2',
  3: 'col-span-12 @md/rock-form:col-span-3',
  4: 'col-span-12 @md/rock-form:col-span-4',
  5: 'col-span-12 @md/rock-form:col-span-5',
  6: 'col-span-12 @md/rock-form:col-span-6',
  7: 'col-span-12 @md/rock-form:col-span-7',
  8: 'col-span-12 @md/rock-form:col-span-8',
  9: 'col-span-12 @md/rock-form:col-span-9',
  10: 'col-span-12 @md/rock-form:col-span-10',
  11: 'col-span-12 @md/rock-form:col-span-11',
  12: 'col-span-12',
}

function fieldColumnClass(columnSize?: number | null) {
  return fieldColumnClasses[columnSize || 12] || fieldColumnClasses[12]
}

function PersonFields({
  prefix,
  values,
  configuration,
  onChange,
}: {
  prefix?: string
  values: RockPersonBasicValues
  configuration: RockPersonEntryConfiguration
  onChange: (values: RockPersonBasicValues) => void
}) {
  const set = (key: string, value: unknown) => onChange({ ...values, [key]: value })
  const visible = (option: number) => option !== 0
  const required = (option: number) => option === 2
  const fieldPrefix = prefix ? `${prefix} ` : ''

  return (
    <div className="grid gap-5 @md/rock-form:grid-cols-2">
      <label className={labelClass}>
        {fieldPrefix}First name <span aria-hidden="true">*</span>
        <input
          className={inputClass}
          value={String(values.firstName || '')}
          onChange={(event) => set('firstName', event.target.value)}
          required
          autoComplete="given-name"
        />
      </label>
      <label className={labelClass}>
        {fieldPrefix}Last name <span aria-hidden="true">*</span>
        <input
          className={inputClass}
          value={String(values.lastName || '')}
          onChange={(event) => set('lastName', event.target.value)}
          required
          autoComplete="family-name"
        />
      </label>
      {visible(configuration.emailOption) && (
        <label className={labelClass}>
          {fieldPrefix}Email{required(configuration.emailOption) && ' *'}
          <input
            className={inputClass}
            type="email"
            value={String(values.email || '')}
            onChange={(event) => set('email', event.target.value)}
            required={required(configuration.emailOption)}
            autoComplete="email"
          />
        </label>
      )}
      {visible(configuration.mobilePhoneOption) && (
        <label className={labelClass}>
          {fieldPrefix}Mobile phone
          {required(configuration.mobilePhoneOption) && ' *'}
          <input
            className={inputClass}
            type="tel"
            value={String(values.mobilePhoneNumber || '')}
            onChange={(event) => set('mobilePhoneNumber', event.target.value)}
            required={required(configuration.mobilePhoneOption)}
            autoComplete="tel"
          />
        </label>
      )}
      {visible(configuration.genderOption) && (
        <label className={labelClass}>
          {fieldPrefix}Gender{required(configuration.genderOption) && ' *'}
          <FormSelect
            value={values.personGender == null ? '' : String(values.personGender)}
            onChange={(event) =>
              set(
                'personGender',
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
            required={required(configuration.genderOption)}
          >
            <option value="">Select…</option>
            <option value="0">Unknown</option>
            <option value="1">Male</option>
            <option value="2">Female</option>
          </FormSelect>
        </label>
      )}
      {visible(configuration.birthDateOption) && (
        <label className={labelClass}>
          {fieldPrefix}Date of birth
          {required(configuration.birthDateOption) && ' *'}
          <input
            className={inputClass}
            type="date"
            value={String(values.personBirthDate || '').slice(0, 10)}
            onChange={(event) => set('personBirthDate', event.target.value)}
            required={required(configuration.birthDateOption)}
          />
        </label>
      )}
      {configuration.isSmsVisible && (
        <label className="flex items-start gap-3 text-sm text-dark-grey @md/rock-form:col-span-2">
          <input
            className="mt-1 h-4 w-4 accent-rich-red"
            type="checkbox"
            checked={values.isMessagingEnabled === true}
            onChange={(event) => set('isMessagingEnabled', event.target.checked)}
          />
          I agree to receive text messages related to this request.
        </label>
      )}
    </div>
  )
}

function AddressInputs({
  value,
  onChange,
  required,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  const address: Record<string, string> = {
    country: 'NZ',
    ...parseJson<Record<string, string>>(value, {}),
  }
  const set = (key: string, nextValue: string) =>
    onChange(JSON.stringify({ ...address, [key]: nextValue }))

  return (
    <div className="grid gap-4 @md/rock-form:grid-cols-2">
      <input
        className={`${inputClass} @md/rock-form:col-span-2`}
        aria-label="Street address"
        placeholder="Street address"
        value={address.street1 || ''}
        onChange={(event) => set('street1', event.target.value)}
        required={required}
        autoComplete="address-line1"
      />
      <input
        className={`${inputClass} @md/rock-form:col-span-2`}
        aria-label="Address line 2"
        placeholder="Address line 2 (optional)"
        value={address.street2 || ''}
        onChange={(event) => set('street2', event.target.value)}
        autoComplete="address-line2"
      />
      <input
        className={inputClass}
        aria-label="City"
        placeholder="City"
        value={address.city || ''}
        onChange={(event) => set('city', event.target.value)}
        autoComplete="address-level2"
      />
      <input
        className={inputClass}
        aria-label="Region"
        placeholder="Region"
        value={address.state || ''}
        onChange={(event) => set('state', event.target.value)}
        autoComplete="address-level1"
      />
      <input
        className={inputClass}
        aria-label="Postcode"
        placeholder="Postcode"
        value={address.postalCode || ''}
        onChange={(event) => set('postalCode', event.target.value)}
        autoComplete="postal-code"
      />
      <input
        className={inputClass}
        aria-label="Country"
        placeholder="Country"
        value={address.country}
        onChange={(event) => set('country', event.target.value)}
        autoComplete="country"
      />
    </div>
  )
}

function RockField({
  field,
  value,
  contextToken,
  workflowTypeGuid,
  onChange,
  onFile,
}: {
  field: RockFormField
  value: string
  contextToken: string
  workflowTypeGuid: string
  onChange: (value: string) => void
  onFile: (file: File | null) => void
}) {
  const datePickerId = useId()
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const type = field.attribute.fieldTypeGuid.toLowerCase()
  const configuration = field.attribute.configurationValues
  const required = field.isRequired || field.attribute.isRequired
  const options = parseRockOptions(configuration.values)
  const label = field.attribute.name
  const shared = { className: inputClass, required: Boolean(required) }

  let control: React.ReactNode
  if (type === ROCK_FIELD_TYPES.memo) {
    control = (
      <textarea
        {...shared}
        rows={Number(configuration.numberofrows) || 5}
        maxLength={Number(configuration.maxcharacters) || undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  } else if (type === ROCK_FIELD_TYPES.singleSelect) {
    control = (
      <FormSelect required={Boolean(required)} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={Boolean(option.disabled)}>
            {option.text}
          </option>
        ))}
      </FormSelect>
    )
  } else if (
    type === ROCK_FIELD_TYPES.multiSelect ||
    type === ROCK_FIELD_TYPES.campuses
  ) {
    const selected = value ? value.split(',') : []
    control = (
      <div className="mt-3 grid gap-3 @md/rock-form:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-start gap-3 text-sm font-normal">
            <input
              className="mt-1 h-4 w-4 accent-rich-red"
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, option.value]
                  : selected.filter((item) => item !== option.value)
                onChange(next.join(','))
              }}
            />
            {option.text}
          </label>
        ))}
        {required && <input className="sr-only" value={value} required readOnly />}
      </div>
    )
  } else if (type === ROCK_FIELD_TYPES.boolean) {
    control = (
      <FormSelect required={Boolean(required)} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select…</option>
        <option value="True">{configuration.truetext || 'Yes'}</option>
        <option value="False">{configuration.falsetext || 'No'}</option>
      </FormSelect>
    )
  } else if (type === ROCK_FIELD_TYPES.gender) {
    control = (
      <FormSelect required={Boolean(required)} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select…</option>
        <option value="0">Unknown</option>
        <option value="1">Male</option>
        <option value="2">Female</option>
      </FormSelect>
    )
  } else if (type === ROCK_FIELD_TYPES.address) {
    control = <AddressInputs value={value} onChange={onChange} required={required} />
  } else if (type === ROCK_FIELD_TYPES.phone) {
    const phone = parseJson<{ number?: string; countryCode?: string }>(value, {})
    control = (
      <input
        {...shared}
        type="tel"
        value={phone.number || ''}
        onChange={(event) =>
          onChange(JSON.stringify({ number: event.target.value, countryCode: phone.countryCode || 'NZ' }))
        }
        autoComplete="tel"
      />
    )
  } else if (type === ROCK_FIELD_TYPES.file || type === ROCK_FIELD_TYPES.image) {
    control = (
      <input
        {...shared}
        type="file"
        accept={type === ROCK_FIELD_TYPES.image ? 'image/*' : undefined}
        onChange={(event) => onFile(event.target.files?.[0] || null)}
      />
    )
  } else if (type === ROCK_FIELD_TYPES.person) {
    control = (
      <PersonSearchField
        value={value}
        contextToken={contextToken}
        workflowTypeGuid={workflowTypeGuid}
        required={required}
        onChange={onChange}
      />
    )
  } else if (type === ROCK_FIELD_TYPES.date) {
    control = (
      <CalendarDatePicker
        id={datePickerId}
        label={label}
        startDate={value.slice(0, 10)}
        isOpen={isDatePickerOpen}
        onOpen={() => setIsDatePickerOpen((open) => !open)}
        onComplete={() => setIsDatePickerOpen(false)}
        onChange={(date) => onChange(date)}
        required={Boolean(required)}
      />
    )
  } else {
    const htmlType = getHtmlInputType(type)
    control = (
      <input
        {...shared}
        type={htmlType}
        step={type === ROCK_FIELD_TYPES.currency ? '0.01' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  const fieldLabel = (
    <>
      {!field.isLabelHidden && (
        <span>
          {label}
          {required && ' *'}
        </span>
      )}
      {field.attribute.description && (
        <span className="mt-1 block font-normal text-dark-grey">
          {field.attribute.description}
        </span>
      )}
    </>
  )

  return (
    <div className="space-y-1">
      <SafeRockHtml value={field.preHtml || field.attribute.preHtml} />
      {type === ROCK_FIELD_TYPES.date ? (
        <>
          <div className={labelClass}>{fieldLabel}</div>
          <div className="mt-2">{control}</div>
        </>
      ) : (
        <label className={labelClass}>
          {fieldLabel}
          {control}
        </label>
      )}
      <SafeRockHtml value={field.postHtml || field.attribute.postHtml} />
    </div>
  )
}

function getHtmlInputType(fieldTypeGuid: string) {
  if (fieldTypeGuid === ROCK_FIELD_TYPES.date) return 'date'
  if (fieldTypeGuid === ROCK_FIELD_TYPES.dateTime) return 'datetime-local'
  if (
    fieldTypeGuid === ROCK_FIELD_TYPES.integer ||
    fieldTypeGuid === ROCK_FIELD_TYPES.currency
  ) {
    return 'number'
  }
  if (fieldTypeGuid === ROCK_FIELD_TYPES.url) return 'url'
  return 'text'
}

function withPersonDefaults(
  initial: RockPersonEntryValues | null,
  defaults?: { name: string; email: string } | null,
) {
  if (!initial || !defaults) return initial
  const nameParts = defaults.name.trim().split(/\s+/)
  return {
    ...initial,
    person: {
      ...initial.person,
      firstName: initial.person.firstName || nameParts[0] || null,
      lastName:
        initial.person.lastName || nameParts.slice(1).join(' ') || null,
      email: initial.person.email || defaults.email,
    },
  }
}

function initialPersonEntryState(
  schema: RockFormSchema | null | undefined,
  defaults?: { name: string; email: string } | null,
) {
  if (!schema?.personEntry) return null

  return withPersonDefaults(
    schema.initialPersonEntryValues || defaultPersonEntryValues(),
    defaults,
  )
}

function PersonSearchField({
  value,
  contextToken,
  workflowTypeGuid,
  required,
  onChange,
}: {
  value: string
  contextToken: string
  workflowTypeGuid: string
  required?: boolean
  onChange: (value: string) => void
}) {
  const selected = parseJson<Partial<RockListItem>>(value, {})
  const [query, setQuery] = useState(selected.text || '')
  const [results, setResults] = useState<RockListItem[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      required && query.trim() && !selected.value
        ? 'Choose a person from the search results.'
        : '',
    )
  }, [query, required, selected.value])

  useEffect(() => {
    if (query.trim().length < 3 || query === selected.text) {
      setResults([])
      setSearching(false)
      return
    }

    const controller = new AbortController()
    let active = true
    setResults([])
    setSearchError('')
    const timeout = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(
          `/api/rock-entry-forms/${workflowTypeGuid}/people`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, contextToken }),
            signal: controller.signal,
          },
        )
        const data = (await response.json()) as {
          people?: RockListItem[]
          error?: string
        }
        if (!response.ok) throw new Error(data.error || 'Unable to search people')
        if (active) setResults(data.people || [])
      } catch (caught) {
        if (
          active &&
          !(caught instanceof DOMException && caught.name === 'AbortError')
        ) {
          setSearchError(
            caught instanceof Error ? caught.message : 'Unable to search people',
          )
        }
      } finally {
        if (active) setSearching(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query, selected.text, contextToken, workflowTypeGuid])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className={inputClass}
        type="search"
        value={query}
        required={required}
        placeholder="Type at least 3 letters"
        onChange={(event) => {
          setQuery(event.target.value)
          onChange('')
        }}
      />
      {searching && <p className="mt-1 text-xs text-dark-grey">Searching…</p>}
      {searchError && <p className="mt-1 text-xs text-red-700">{searchError}</p>}
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-warm-grey bg-white shadow-lg">
          {results.map((person) => (
            <button
              key={person.value}
              className="block w-full px-4 py-3 text-left text-sm hover:bg-warm-white"
              type="button"
              onClick={() => {
                onChange(JSON.stringify(person))
                setQuery(person.text)
                setResults([])
              }}
            >
              {person.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function RockForm({
  workflowTypeGuid,
  groupGuid,
  initialSchema = null,
  fallbackAction = DEFAULT_FORM_FALLBACK_ACTION,
  scrollContainerRef,
  personDefaults,
}: {
  workflowTypeGuid: string
  groupGuid?: string
  initialSchema?: RockFormSchema | null
  fallbackAction?: FormFallbackAction
  scrollContainerRef?: RefObject<HTMLElement | null>
  personDefaults?: { name: string; email: string } | null
}) {
  const [schema, setSchema] = useState<RockFormSchema | null>(initialSchema)
  const [startupSiteKey, setStartupSiteKey] = useState(
    initialSchema?.turnstileSiteKey || '',
  )
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    initialSchema?.initialFieldValues || {},
  )
  const [personEntryValues, setPersonEntryValues] =
    useState<RockPersonEntryValues | null>(
      initialPersonEntryState(initialSchema, personDefaults),
    )
  const [files, setFiles] = useState<Record<string, File>>({})
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [startupRetryKey, setStartupRetryKey] = useState(0)
  const [loading, setLoading] = useState(!initialSchema)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [completeMessage, setCompleteMessage] = useState('')
  const startController = useRef<AbortController | null>(null)
  const submitController = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const spouseFieldsId = useId()

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      startController.current?.abort()
      submitController.current?.abort()
    }
  }, [])

  const applySchema = useCallback((nextSchema: RockFormSchema) => {
    setSchema(nextSchema)
    setFieldValues(nextSchema.initialFieldValues)
    setPersonEntryValues(initialPersonEntryState(nextSchema, personDefaults))
    setFiles({})
    setTurnstileToken('')
    setTurnstileResetKey((key) => key + 1)
  }, [personDefaults])

  useEffect(() => {
    if (initialSchema) {
      setSchema(initialSchema)
      setStartupSiteKey(initialSchema.turnstileSiteKey)
      setFieldValues(initialSchema.initialFieldValues)
      setPersonEntryValues(initialPersonEntryState(initialSchema, personDefaults))
      setFiles({})
      setError('')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    let active = true
    setSchema(null)
    setStartupSiteKey('')
    setError('')
    setLoading(true)
    fetch(`/api/rock-entry-forms/${workflowTypeGuid}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await readJsonResponse<FormStartResponse>(response)
        if (!response.ok) throw new Error(data.error || FORM_STARTUP_ERROR)
        if (!data.turnstileSiteKey) throw new Error(FORM_STARTUP_ERROR)
        if (active) setStartupSiteKey(data.turnstileSiteKey)
      })
      .catch((caught) => {
        if (
          active &&
          caught instanceof Error &&
          caught.name !== 'AbortError'
        ) {
          setError(caught instanceof TypeError ? FORM_STARTUP_ERROR : caught.message)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
      startController.current?.abort()
      submitController.current?.abort()
    }
  }, [workflowTypeGuid, groupGuid, initialSchema, startupRetryKey, personDefaults])

  const startForm = useCallback(
    async (token: string) => {
      if (!token) return
      startController.current?.abort()
      const controller = new AbortController()
      startController.current = controller
      setError('')

      try {
        const body = new FormData()
        body.set('intent', 'start')
        body.set('turnstileToken', token)
        if (groupGuid) body.set('groupGuid', groupGuid)
        const response = await fetch(`/api/rock-entry-forms/${workflowTypeGuid}`, {
          method: 'POST',
          body,
          signal: controller.signal,
        })
        const data = await readJsonResponse<FormStartResponse>(response)
        if (!response.ok) throw new Error(data.error || FORM_STARTUP_ERROR)
        if (!isRockFormSchema(data)) throw new Error('Rock returned an invalid form')
        if (!controller.signal.aborted && mounted.current) {
          applySchema(data)
        }
      } catch (caught) {
        if (
          !controller.signal.aborted &&
          mounted.current &&
          caught instanceof Error
        ) {
          setStartupSiteKey('')
          setError(caught.message)
          setTurnstileResetKey((key) => key + 1)
        }
      }
    },
    [workflowTypeGuid, groupGuid, applySchema],
  )

  const fieldsBySection = useMemo(() => {
    if (!schema) return new Map<string, RockFormField[]>()
    const groups = new Map<string, RockFormField[]>()
    for (const field of schema.fields) {
      const key = field.sectionId || ''
      const fields = groups.get(key)
      if (fields) fields.push(field)
      else groups.set(key, [field])
    }
    return groups
  }, [schema])

  const marriedStatusGuid = useMemo(
    () =>
      schema?.personEntry?.maritalStatuses?.find(
        (status) => status.text.trim().toLowerCase() === 'married',
      )?.value || null,
    [schema],
  )

  if (loading) return <p className="text-dark-grey">Loading form…</p>
  if (completeMessage) {
    return (
      <div role="status" className="rounded-lg bg-green-50 p-5 text-green-900">
        {completeMessage}
      </div>
    )
  }
  if (!schema) {
    if (!startupSiteKey) {
      return error ? (
        <div className="space-y-4 rounded-lg bg-red-50 p-5 text-red-900">
          <p role="alert">{error}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => setStartupRetryKey((key) => key + 1)}
            >
              Try again
            </Button>
            <Button
              href={fallbackAction.href}
              variant="secondary"
            >
              {fallbackAction.label}
            </Button>
          </div>
        </div>
      ) : null
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-dark-grey">Preparing secure form…</p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <TurnstileWidget
          siteKey={startupSiteKey}
          action={ROCK_FORM_START_ACTION}
          resetKey={turnstileResetKey}
          onToken={startForm}
          onError={() => {
            setStartupSiteKey('')
            setError(FORM_STARTUP_ERROR)
          }}
        />
      </div>
    )
  }

  const updateField = (guid: string, value: string) =>
    setFieldValues((current) => ({ ...current, [guid]: value }))

  const renderFields = (fields: RockFormField[]) => (
    <div className="grid grid-cols-12 gap-x-5 gap-y-6">
      {fields.map((field) =>
        isRockRuleVisible(field.visibilityRule, fieldValues) ? (
          <div
            key={field.attribute.attributeGuid}
            className={fieldColumnClass(field.columnSize)}
          >
            <RockField
              field={field}
              value={fieldValues[field.attribute.attributeGuid] || ''}
              contextToken={schema.contextToken}
              workflowTypeGuid={workflowTypeGuid}
              onChange={(value) => updateField(field.attribute.attributeGuid, value)}
              onFile={(file) =>
                setFiles((current) => {
                  const next = { ...current }
                  if (file) next[field.attribute.attributeGuid] = file
                  else delete next[field.attribute.attributeGuid]
                  return next
                })
              }
            />
          </div>
        ) : null,
      )}
    </div>
  )

  const contextReady = Boolean(schema.contextToken)
  const spouseFields = schema.personEntry && personEntryValues && (
    <PersonFields
      prefix={schema.personEntry.spouseLabel || 'Spouse'}
      values={personEntryValues.spouse || {}}
      configuration={schema.personEntry}
      onChange={(spouse) =>
        setPersonEntryValues({
          ...personEntryValues,
          spouse,
          maritalStatusGuid:
            personEntryValues.maritalStatusGuid || marriedStatusGuid,
        })
      }
    />
  )

  return (
    <form
      data-analytics-sensitive
      className="@container/rock-form space-y-8"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!turnstileToken) {
          setError('Please complete the bot check before submitting.')
          return
        }

        setSubmitting(true)
        setError('')
        try {
          const submitter = (event.nativeEvent as SubmitEvent).submitter as
            | HTMLButtonElement
            | null
          const body = new FormData()
          body.set('contextToken', schema.contextToken)
          body.set('turnstileToken', turnstileToken)
          body.set('fieldValues', JSON.stringify(fieldValues))
          body.set('personEntryValues', JSON.stringify(personEntryValues))
          body.set('button', submitter?.value || '')
          for (const [guid, file] of Object.entries(files)) {
            body.set(`file:${guid.toLowerCase()}`, file)
          }

          submitController.current?.abort()
          const controller = new AbortController()
          submitController.current = controller
          const response = await fetch(`/api/rock-entry-forms/${workflowTypeGuid}`, {
            method: 'POST',
            body,
            signal: controller.signal,
          })
          const result = await readJsonResponse<FormSubmitResponse>(response)
          if (!response.ok) throw new Error(result.error || 'Unable to submit form')
          if (controller.signal.aborted || !mounted.current) return

          if (result.status === 'next') {
            if (!isRockFormSchema(result.form)) {
              throw new Error('Rock returned an invalid next step')
            }
            applySchema(result.form)
            const scrollTarget = scrollContainerRef?.current
            if (scrollTarget) {
              scrollTarget.scrollTo({ top: 0, behavior: 'smooth' })
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          } else if (isCompleteResponse(result)) {
            trackSuccessfulFormSubmission(window.location.pathname, 'workflow')
            if (result.redirectUrl) window.location.assign(result.redirectUrl)
            else {
              setCompleteMessage(
                result.message || 'Thanks. Your form has been submitted.',
              )
            }
          } else {
            throw new Error('Rock returned an invalid submission response')
          }
        } catch (caught) {
          if (caught instanceof DOMException && caught.name === 'AbortError') return
          setError(caught instanceof Error ? caught.message : 'Unable to submit form')
          setTurnstileToken('')
          setTurnstileResetKey((key) => key + 1)
        } finally {
          setSubmitting(false)
        }
      }}
    >
      <fieldset disabled={!contextReady} className="contents">
        <SafeRockHtml value={schema.headerHtml} />

        {schema.personEntry && personEntryValues && (
          <section className="space-y-5 py-4">
          <SafeRockHtml value={schema.personEntry.preHtml} />
          {schema.personEntry.title && (
            <h3 className="text-2xl font-semibold text-brand-black">
              {schema.personEntry.title}
            </h3>
          )}
          {schema.personEntry.description && (
            <p className="text-dark-grey">{schema.personEntry.description}</p>
          )}
          {schema.personEntry.isCampusVisible && (
            <label className={labelClass}>
              Campus *
              <FormSelect
                value={personEntryValues.campusGuid || ''}
                onChange={(event) =>
                  setPersonEntryValues({
                    ...personEntryValues,
                    campusGuid: event.target.value || null,
                  })
                }
                required
              >
                <option value="">Select…</option>
                {(schema.personEntry.campuses || []).map((campus) => (
                  <option key={campus.value} value={campus.value}>
                    {campus.text}
                  </option>
                ))}
              </FormSelect>
            </label>
          )}
          <PersonFields
            values={personEntryValues.person || {}}
            configuration={schema.personEntry}
            onChange={(person) =>
              setPersonEntryValues({ ...personEntryValues, person })
            }
          />
          {schema.personEntry.spouseOption !== 0 && (
            <div className="border-t border-warm-grey pt-6 pb-4">
              {schema.personEntry.spouseOption === 1 && (
                <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-brand-black">
                  <input
                    className="h-4 w-4 shrink-0 accent-rich-red"
                    type="checkbox"
                    checked={personEntryValues.spouse != null}
                    aria-expanded={personEntryValues.spouse != null}
                    aria-controls={spouseFieldsId}
                    onChange={(event) =>
                      setPersonEntryValues({
                        ...personEntryValues,
                        spouse: event.target.checked ? {} : null,
                        maritalStatusGuid:
                          event.target.checked && !personEntryValues.maritalStatusGuid
                            ? marriedStatusGuid
                            : personEntryValues.maritalStatusGuid,
                      })
                    }
                  />
                  Show {schema.personEntry.spouseLabel || 'Spouse'}
                </label>
              )}
              {schema.personEntry.spouseOption === 2 ? (
                spouseFields
              ) : (
                <div
                  id={spouseFieldsId}
                  aria-hidden={personEntryValues.spouse == null}
                  className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
                  style={{
                    gridTemplateRows:
                      personEntryValues.spouse != null ? '1fr' : '0fr',
                    opacity: personEntryValues.spouse != null ? 1 : 0,
                  }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <fieldset
                      className="pt-5"
                      disabled={personEntryValues.spouse == null}
                    >
                      {spouseFields}
                    </fieldset>
                  </div>
                </div>
              )}
            </div>
          )}
          {schema.personEntry.addressOption !== 0 && (
            <label className={labelClass}>
              Address{schema.personEntry.addressOption === 2 && ' *'}
              <AddressInputs
                value={JSON.stringify(personEntryValues.address || {})}
                onChange={(value) =>
                  setPersonEntryValues({
                    ...personEntryValues,
                    address: parseJson(value, {}),
                  })
                }
                required={schema.personEntry.addressOption === 2}
              />
            </label>
          )}
          <SafeRockHtml value={schema.personEntry.postHtml} />
          </section>
        )}

        {schema.sections.map((section) =>
          isRockRuleVisible(section.visibilityRule, fieldValues) ? (
            <section key={section.id} className="space-y-5 py-4">
              {section.title && (
                <h3 className="text-2xl font-semibold text-brand-black">
                  {section.title}
                </h3>
              )}
              {section.description && (
                <p className="text-dark-grey">{section.description}</p>
              )}
              {renderFields(fieldsBySection.get(section.id) || [])}
            </section>
          ) : null,
        )}
        {renderFields(fieldsBySection.get('') || [])}

        <SafeRockHtml value={schema.footerHtml} />
      </fieldset>
      <TurnstileWidget
        siteKey={schema.turnstileSiteKey}
        action={contextReady ? ROCK_FORM_SUBMIT_ACTION : ROCK_FORM_START_ACTION}
        resetKey={turnstileResetKey}
        onToken={contextReady ? setTurnstileToken : startForm}
        onError={setError}
      />
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {schema.buttons.map((button) => (
            <button
              key={button.title}
              className="rounded-full bg-rich-red px-7 py-3 font-semibold text-white transition hover:bg-rich-red/90 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              value={button.title}
              disabled={submitting || !contextReady}
            >
              {submitting ? 'Submitting…' : button.title}
            </button>
          ))}
      </div>
    </form>
  )
}
