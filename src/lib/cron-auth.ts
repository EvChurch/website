type CronRequest = Pick<Request, 'headers' | 'url'>

export function isCronRequestAuthorized(
  request: CronRequest,
  configuredSecret: string,
): boolean {
  if (!configuredSecret) return false

  const authorization = request.headers.get('authorization')
  if (authorization === `Bearer ${configuredSecret}`) return true

  return new URL(request.url).searchParams.get('secret') === configuredSecret
}
