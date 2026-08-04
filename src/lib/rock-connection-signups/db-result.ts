export function drizzleResultRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (
    value &&
    typeof value === 'object' &&
    'rows' in value &&
    Array.isArray(value.rows)
  ) {
    return value.rows
  }
  return []
}
