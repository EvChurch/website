import { readAuth0Config } from './auth0-config'
import { readMemberRockConfig } from './member-rock-config'

function validateMemberAuthConfig() {
  readAuth0Config()
  readMemberRockConfig()
}

/**
 * Invalid or partial optional member configuration must not break anonymous
 * pages. Auth0 itself remains required for the Payload admin flow.
 */
export function isMemberAuthEnabled() {
  try {
    validateMemberAuthConfig()
    return true
  } catch {
    return false
  }
}
