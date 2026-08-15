import { isAnalyticsSensitivePath, matchesPathPrefix } from './public-paths'

export function canTrackAnalyticsPath(pathname: string): boolean {
  return !isAnalyticsSensitivePath(pathname)
}

export function mustPauseAnalyticsCapture(pathname: string): boolean {
  return matchesPathPrefix(pathname, '/give')
    || matchesPathPrefix(pathname, '/giving-e2e')
    || matchesPathPrefix(pathname, '/shared')
}
