/** Deployment switch. Staff/Exec and public opening checks also run on the server. */
export function campaignGivingEnabled() {
  return process.env.GIVING_CAMPAIGN_ENABLED === 'true'
}
