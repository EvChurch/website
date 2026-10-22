export async function loadGivingSubmissionVersion(signal: AbortSignal): Promise<string> {
  const response = await fetch('/api/giving/session', { cache: 'no-store', signal })
  const value: unknown = await response.json()
  if (!response.ok || !value || typeof value !== 'object' || !('version' in value) ||
      typeof value.version !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(value.version)) {
    throw new Error('Giving session unavailable')
  }
  return value.version
}
