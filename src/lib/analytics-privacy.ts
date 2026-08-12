import { matchesPathPrefix } from './public-paths'

const SENSITIVE_PREFIXES = [
  '/admin',
  '/api',
  '/auth',
  '/contact',
  '/give',
  '/member-auth',
  '/member-avatar',
  '/member-sign-in',
  '/members',
  '/privacy',
]

const REPLAY_PUBLIC_PREFIXES = [
  '/blog',
  '/campus',
  '/events',
  '/hs',
  '/sermons',
]

export function canTrackAnalyticsPath(pathname: string): boolean {
  return !SENSITIVE_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix))
}

export function canReplayPath(pathname: string): boolean {
  if (!canTrackAnalyticsPath(pathname)) return false
  if (pathname === '/') return true

  return REPLAY_PUBLIC_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix))
}
