export type ConnectionOption = { blockGuid: string; label: string }

export type ConnectionPickerState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'noMatch' }
  | { kind: 'ineligible'; value: string }
  | { kind: 'ready' }

export function deriveConnectionPickerState({
  loading,
  error,
  options,
  value,
  query,
}: {
  loading: boolean
  error: string
  options: ConnectionOption[]
  value: string
  query: string
}): ConnectionPickerState {
  if (loading) return { kind: 'loading' }
  if (error) return { kind: 'error', message: error }
  if (value && !options.some((option) => option.blockGuid === value)) {
    return { kind: 'ineligible', value }
  }
  if (options.length === 0) return { kind: 'empty' }
  const normalizedQuery = query.trim().toLowerCase()
  if (
    normalizedQuery &&
    !options.some((option) =>
      `${option.label} ${option.blockGuid}`.toLowerCase().includes(normalizedQuery),
    )
  ) return { kind: 'noMatch' }
  return { kind: 'ready' }
}
