import { readMemberRockConfig } from './member-rock-config'
import { readBoundedResponseBody } from './member-rock-response'

const ROCK_IMAGE_PATH = '/GetImage.ashx'
const ROCK_AVATAR_PATH = '/GetAvatar.ashx'
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

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/u.test(value)
}

function readUniqueParameters(
  photoUrl: URL,
  allowedNames: ReadonlySet<string>,
) {
  const parameters = new Map<string, string>()
  for (const [rawName, value] of photoUrl.searchParams) {
    const name = rawName.toLowerCase()
    if (!allowedNames.has(name) || parameters.has(name)) return null
    parameters.set(name, value)
  }
  return parameters
}

function isAllowedImageUrl(photoUrl: URL) {
  const parameters = readUniqueParameters(
    photoUrl,
    new Set(['id', 'guid', 'w', 'h']),
  )
  if (!parameters) return false

  const id = parameters.get('id')
  const guid = parameters.get('guid')
  if ((id ? 1 : 0) + (guid ? 1 : 0) !== 1) return false
  if (id && !isPositiveInteger(id, Number.MAX_SAFE_INTEGER)) return false
  if (guid && !isGuid(guid)) return false

  for (const dimension of ['w', 'h']) {
    const value = parameters.get(dimension)
    if (value && !isPositiveInteger(value, MAX_IMAGE_DIMENSION)) return false
  }

  return true
}

function isAllowedAvatarUrl(photoUrl: URL) {
  const parameters = readUniqueParameters(
    photoUrl,
    new Set([
      'photoid',
      'fileidkey',
      'ageclassification',
      'gender',
      'recordtypeid',
      'text',
      'style',
      'size',
    ]),
  )
  if (!parameters) return false

  const photoId = parameters.get('photoid')
  const fileIdKey = parameters.get('fileidkey')
  if ((photoId ? 1 : 0) + (fileIdKey ? 1 : 0) !== 1) return false
  if (photoId && !isPositiveInteger(photoId, Number.MAX_SAFE_INTEGER)) {
    return false
  }
  if (fileIdKey && !/^[a-z0-9_-]{1,128}$/iu.test(fileIdKey)) return false

  for (const name of ['ageclassification', 'gender']) {
    const value = parameters.get(name)
    if (value && !/^[a-z][a-z0-9]{0,31}$/iu.test(value)) return false
  }

  const recordTypeId = parameters.get('recordtypeid')
  if (
    recordTypeId &&
    !isPositiveInteger(recordTypeId, Number.MAX_SAFE_INTEGER)
  ) {
    return false
  }

  const text = parameters.get('text')
  if (text && (text.length > 16 || hasControlCharacters(text))) return false

  const style = parameters.get('style')
  if (style && style.toLowerCase() !== 'icon') return false

  const size = parameters.get('size')
  if (size && !isPositiveInteger(size, MAX_IMAGE_DIMENSION)) return false

  return true
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
    photoUrl.hash
  ) {
    return null
  }

  const allowed =
    (photoUrl.pathname === ROCK_IMAGE_PATH && isAllowedImageUrl(photoUrl)) ||
    (photoUrl.pathname === ROCK_AVATAR_PATH && isAllowedAvatarUrl(photoUrl))
  if (!allowed) return null

  return photoUrl
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
      await response.body?.cancel()
      return fail('upstream-redirect', response.status)
    }
    if (!response.ok) {
      await response.body?.cancel()
      return fail('upstream-denied', response.status)
    }

    const contentType = response.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase()
    if (!contentType || !supportedImageTypes.has(contentType)) {
      await response.body?.cancel()
      return fail('unsupported-content')
    }

    const body = await readBoundedResponseBody(response, MAX_AVATAR_BYTES)
    if (!body) return fail('oversized-content')
    return { body, contentType }
  } catch {
    return fail('upstream-unavailable')
  }
}
