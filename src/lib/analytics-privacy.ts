import { isAnalyticsSensitivePath, matchesPathPrefix } from './public-paths'

const REPLAY_PUBLIC_PREFIXES = [
  '/blog',
  '/campus',
  '/events',
  '/hs',
  '/sermons',
]

export function canTrackAnalyticsPath(pathname: string): boolean {
  return !isAnalyticsSensitivePath(pathname)
}

export function canReplayPath(pathname: string): boolean {
  if (!canTrackAnalyticsPath(pathname)) return false
  if (pathname === '/') return true

  return REPLAY_PUBLIC_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix))
}
