import { isAnalyticsSensitivePath } from './public-paths'

export function canTrackAnalyticsPath(pathname: string): boolean {
  return !isAnalyticsSensitivePath(pathname)
}
