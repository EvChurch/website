import { readMemberRockConfig } from './member-rock-config'
import { readBoundedResponseBody } from './member-rock-response'
import { isGuid } from '@/lib/rock-forms/constants'

const FILE_TIMEOUT_MS = 5_000
const MAX_FILE_BYTES = 25 * 1024 * 1024
const supportedFileTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

export interface MemberRockFile {
  body: Uint8Array<ArrayBuffer>
  contentType: string
}

export class MemberRockFileUnavailableError extends Error {
  constructor(
    message: string,
    readonly upstreamStatus?: number,
  ) {
    super(message)
    this.name = 'MemberRockFileUnavailableError'
  }
}

export async function fetchMemberRockFile(guid: string): Promise<MemberRockFile | null> {
  if (!isGuid(guid)) return null

  try {
    const config = readMemberRockConfig()
    const url = new URL('/GetFile.ashx', config.apiUrl)
    url.searchParams.set('Guid', guid)
    const response = await fetch(url, {
      headers: {
        Accept: [...supportedFileTypes].join(','),
        'Authorization-Token': config.apiKey,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
      cache: 'no-store',
    })

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel()
      return null
    }
    if (response.status === 404) {
      await response.body?.cancel()
      return null
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new MemberRockFileUnavailableError(
        'Rock member file service returned an error',
        response.status,
      )
    }
    const contentType = response.headers.get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase()
    if (!contentType || !supportedFileTypes.has(contentType)) {
      await response.body?.cancel()
      return null
    }
    const body = await readBoundedResponseBody(response, MAX_FILE_BYTES)
    return body ? { body, contentType } : null
  } catch (error) {
    if (error instanceof MemberRockFileUnavailableError) throw error
    throw new MemberRockFileUnavailableError('Rock member file service is unavailable')
  }
}
