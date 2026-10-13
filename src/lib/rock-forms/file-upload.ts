import { isGuid } from './constants'

export const ROCK_DEFAULT_BINARY_FILE_TYPE_GUID =
  'c1142570-8cd6-4a20-83b1-acb47c1cd377'

export function resolveRockBinaryFileTypeGuid(value?: string): string {
  if (value && isGuid(value)) return value

  try {
    const parsed = JSON.parse(value || '{}') as { value?: unknown }
    if (typeof parsed.value === 'string' && isGuid(parsed.value)) {
      return parsed.value
    }
  } catch {
    // Rock also returns the file type as a bare GUID.
  }

  // Rock's native uploader uses the default file type when none is configured.
  return ROCK_DEFAULT_BINARY_FILE_TYPE_GUID
}
