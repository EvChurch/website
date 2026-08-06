import { readMemberRockConfig } from './member-rock-config'

const ROCK_IMAGE_PATH = '/GetImage.ashx'
const AVATAR_TIMEOUT_MS = 3_000
const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 2_048
const supportedImageTypes = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export interface MemberRockAvatar {
  body: Uint8Array<ArrayBuffer>
  contentType: string
}

type AvatarFailureReason =
  | 'invalid-reference'
  | 'upstream-denied'
  | 'upstream-redirect'
  | 'upstream-unavailable'
  | 'unsupported-content'
  | 'oversized-content'

function fail(
  reason: AvatarFailureReason,
  status?: number,
): null {
  console.warn('Member Rock avatar fetch failed', {
    reason,
    ...(status === undefined ? {} : { status }),
  })
  return null
}

function isPositiveInteger(value: string, maximum: number) {
  if (!/^[1-9]\d*$/u.test(value)) return false
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed <= maximum
}

function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
    value,
  )
}

function resolveAllowedPhotoUrl(
  photoReference: string,
  apiUrl: string,
): URL | null {
  if (!photoReference.startsWith('/') && !URL.canParse(photoReference)) {
    return null
  }

  const rockApiUrl = new URL(apiUrl)
  const rockOrigin = rockApiUrl.origin
  const photoUrl = new URL(photoReference, `${rockOrigin}/`)

  if (
    photoUrl.origin !== rockOrigin ||
    photoUrl.username ||
    photoUrl.password ||
    photoUrl.hash ||
    photoUrl.pathname !== ROCK_IMAGE_PATH
  ) {
    return null
  }

  const parameters = new Map<string, string>()
  for (const [rawName, value] of photoUrl.searchParams) {
    const name = rawName.toLowerCase()
    if (
      !['id', 'guid', 'w', 'h'].includes(name) ||
      parameters.has(name)
    ) {
      return null
    }
    parameters.set(name, value)
  }

  const id = parameters.get('id')
  const guid = parameters.get('guid')
  if ((id ? 1 : 0) + (guid ? 1 : 0) !== 1) return null
  if (id && !isPositiveInteger(id, Number.MAX_SAFE_INTEGER)) return null
  if (guid && !isGuid(guid)) return null

  for (const dimension of ['w', 'h']) {
    const value = parameters.get(dimension)
    if (value && !isPositiveInteger(value, MAX_IMAGE_DIMENSION)) return null
  }

  return photoUrl
}

async function readBoundedBody(
  response: Response,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const declaredLength = response.headers.get('content-length')
  if (
    declaredLength &&
    (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > MAX_AVATAR_BYTES)
  ) {
    return null
  }
  if (!response.body) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_AVATAR_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

export async function fetchMemberRockAvatar(
  photoReference: string,
): Promise<MemberRockAvatar | null> {
  try {
    const config = readMemberRockConfig()
    const photoUrl = resolveAllowedPhotoUrl(photoReference, config.apiUrl)
    if (!photoUrl) return fail('invalid-reference')

    const response = await fetch(photoUrl, {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
        'Authorization-Token': config.apiKey,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS),
      cache: 'no-store',
    })

    if (response.status >= 300 && response.status < 400) {
      return fail('upstream-redirect', response.status)
    }
    if (!response.ok) return fail('upstream-denied', response.status)

    const contentType = response.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase()
    if (!contentType || !supportedImageTypes.has(contentType)) {
      return fail('unsupported-content')
    }

    const body = await readBoundedBody(response)
    if (!body) return fail('oversized-content')
    return { body, contentType }
  } catch {
    return fail('upstream-unavailable')
  }
}
