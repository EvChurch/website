import type { RockFormSchema } from './types'

export type FormStartResponse = Partial<RockFormSchema> & {
  turnstileSiteKey?: string
  error?: string
}

export type FormSubmitResponse = {
  status?: 'next' | 'complete'
  form?: RockFormSchema
  message?: string
  redirectUrl?: string | null
  error?: string
}

export async function readJsonResponse<T extends object>(
  response: Response,
): Promise<Partial<T>> {
  try {
    const value: unknown = await response.json()
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<T>)
      : {}
  } catch {
    return {}
  }
}

export function isRockFormSchema(value: unknown): value is RockFormSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<RockFormSchema>
  return (
    typeof candidate.workflowTypeGuid === 'string' &&
    typeof candidate.contextToken === 'string' &&
    typeof candidate.turnstileSiteKey === 'string' &&
    Array.isArray(candidate.sections) &&
    Array.isArray(candidate.fields) &&
    Array.isArray(candidate.buttons) &&
    Boolean(candidate.initialFieldValues) &&
    typeof candidate.initialFieldValues === 'object'
  )
}

export function isCompleteResponse(
  value: Partial<FormSubmitResponse>,
): boolean {
  return (
    value.status === 'complete' &&
    (value.message === undefined || typeof value.message === 'string') &&
    (value.redirectUrl === undefined ||
      value.redirectUrl === null ||
      typeof value.redirectUrl === 'string')
  )
}
