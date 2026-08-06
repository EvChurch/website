export interface MemberRockRuntimeConfig {
  apiKey: string
  apiUrl: string
}

const placeholder = /change-me|replace-me|generate-with/i

function requiredMemberRockSetting(name: string) {
  const value = process.env[name]?.trim()
  if (!value || placeholder.test(value)) {
    throw new Error(`Missing or placeholder ${name}`)
  }
  return value
}

export function readMemberRockConfig(): MemberRockRuntimeConfig {
  const url = new URL(requiredMemberRockSetting('MEMBER_ROCK_API_URL'))
  if (url.search || url.hash || url.username || url.password) {
    throw new Error('MEMBER_ROCK_API_URL must not contain credentials, query, or hash')
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('MEMBER_ROCK_API_URL must use HTTPS in production')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('MEMBER_ROCK_API_URL must use HTTP or HTTPS')
  }

  return {
    apiKey: requiredMemberRockSetting('MEMBER_ROCK_API_KEY'),
    apiUrl: url.toString().replace(/\/$/, ''),
  }
}
