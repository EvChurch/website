import { createSign } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { SermonSetting } from '@/payload-types'

export interface DriveRecording {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size: string
  parents?: string[]
  trashed?: boolean
  campusName?: string
}
interface DriveList {
  files: DriveRecording[]
  nextPageToken?: string
}
interface ServiceAccount {
  client_email: string
  private_key: string
}
let cachedToken: { value: string; expires: number } | undefined
const maxBytes = 1024 * 1024 * 1024

export function relationID(
  value: number | { id: number } | null | undefined,
): number | undefined {
  return typeof value === 'number' ? value : value?.id
}

export async function driveToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value
  const raw = process.env.SERMON_DRIVE_SERVICE_ACCOUNT_JSON
  if (!raw)
    throw new Error('An administrator needs to configure Google Drive access.')
  const credentials = JSON.parse(raw) as ServiceAccount
  if (!credentials.client_email || !credentials.private_key)
    throw new Error('Google Drive credentials are incomplete.')
  const now = Math.floor(Date.now() / 1000)
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  const body = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`
  const signature = createSign('RSA-SHA256')
    .update(body)
    .sign(credentials.private_key, 'base64url')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${body}.${signature}`,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok)
    throw new Error(
      'Google Drive authentication failed. Ask an administrator to check access.',
    )
  const result = (await response.json()) as {
    access_token: string
    expires_in: number
  }
  cachedToken = {
    value: result.access_token,
    expires: Date.now() + (result.expires_in - 60) * 1000,
  }
  return cachedToken.value
}

async function driveFetch(
  path: string,
  params: Record<string, string> = {},
  range?: string,
) {
  const url = new URL('https://www.googleapis.com')
  url.pathname = `/drive/v3/${path}`
  url.search = new URLSearchParams({
    supportsAllDrives: 'true',
    ...params,
  }).toString()
  return fetch(
    url,
    {
      headers: {
        Authorization: `Bearer ${await driveToken()}`,
        ...(range ? { Range: range } : {}),
      },
      signal: AbortSignal.timeout(15 * 60_000),
      cache: 'no-store',
    },
  )
}

function folders(settings: SermonSetting) {
  const rows = settings.driveFolders ?? []
  if (!rows.length)
    throw new Error(
      'An administrator needs to configure the campus recording folders in Sermon Settings.',
    )
  if (rows.some((row) => !/^[\w-]+$/.test(row.folderId)))
    throw new Error('A configured Drive folder ID is invalid.')
  return rows
}

export async function listRecordings(
  settings: SermonSetting,
  folderId: string,
  pageToken?: string,
): Promise<DriveList> {
  if (folderId === 'all') {
    const cursors = pageToken
      ? (JSON.parse(Buffer.from(pageToken, 'base64url').toString()) as Record<
          string,
          string | null
        >)
      : undefined
    const next: Record<string, string | null> = {}
    const pages = await Promise.all(
      folders(settings).map(async (folder) => {
        if (cursors && !cursors[folder.folderId]) {
          next[folder.folderId] = null
          return []
        }
        const page = await listRecordings(
          settings,
          folder.folderId,
          cursors?.[folder.folderId] || undefined,
        )
        next[folder.folderId] = page.nextPageToken || null
        return page.files.map((file) => ({
          ...file,
          campusName:
            typeof folder.campus === 'object'
              ? folder.campus.name
              : 'Campus recording',
        }))
      }),
    )
    return {
      files: pages
        .flat()
        .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)),
      ...(Object.values(next).some(Boolean)
        ? {
            nextPageToken: Buffer.from(JSON.stringify(next)).toString(
              'base64url',
            ),
          }
        : {}),
    }
  }
  const folder = folders(settings).find((row) => row.folderId === folderId)
  if (!folder) throw new Error('Choose a configured campus folder.')
  const response = await driveFetch('files', {
    q: `'${folderId}' in parents and trashed = false and (mimeType contains 'audio/' or mimeType = 'video/mp4' or mimeType = 'video/quicktime')`,
    includeItemsFromAllDrives: 'true',
    pageSize: '50',
    orderBy: 'modifiedTime desc',
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size)',
    ...(pageToken ? { pageToken } : {}),
  })
  if (!response.ok)
    throw new Error(
      'Unable to list recordings. Check folder access and try again.',
    )
  return (await response.json()) as DriveList
}

export async function getRecording(settings: SermonSetting, id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error('Invalid recording ID.')
  const response = await driveFetch(`files/${id}`, {
    fields: 'id,name,mimeType,modifiedTime,size,parents,trashed',
  })
  if (!response.ok)
    throw new Error('The recording is unavailable in Google Drive.')
  const file = (await response.json()) as DriveRecording
  const folder = folders(settings).find((row) =>
    file.parents?.includes(row.folderId),
  )
  if (
    !folder ||
    file.trashed ||
    !/^(audio\/|video\/(mp4|quicktime)$)/.test(file.mimeType)
  )
    throw new Error(
      'Choose an audio recording from a configured campus folder.',
    )
  if (!Number(file.size) || Number(file.size) > maxBytes)
    throw new Error('Recordings must be no larger than 1 GB.')
  return { file, campus: relationID(folder.campus)! }
}

export async function downloadRecording(
  settings: SermonSetting,
  id: string,
  modifiedTime: string,
  destination: string,
) {
  const { file } = await getRecording(settings, id)
  if (file.modifiedTime !== modifiedTime)
    throw new Error(
      'The Drive recording changed. Select it again to use the new version.',
    )
  const response = await driveFetch(`files/${id}`, { alt: 'media' })
  if (!response.ok || !response.body)
    throw new Error('Unable to download the recording. Try again.')
  let received = 0
  await pipeline(
    Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),
    new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length
        callback(
          received > maxBytes ? new Error('The recording exceeds 1 GB.') : null,
          chunk,
        )
      },
    }),
    createWriteStream(destination),
  )
  const latest = await getRecording(settings, id)
  if (latest.file.modifiedTime !== modifiedTime)
    throw new Error(
      'The Drive recording changed during download. Select it again.',
    )
  return file
}

/** Authorized byte-range proxy for comparing candidates without publishing or importing them. */
export async function streamRecording(
  settings: SermonSetting,
  id: string,
  range: string | null,
) {
  const { file } = await getRecording(settings, id)
  if (range && !/^bytes=\d*-\d*$/.test(range))
    throw new Error('Invalid audio range.')
  const response = await driveFetch(
    `files/${id}`,
    { alt: 'media' },
    range || undefined,
  )
  if (!response.ok) throw new Error('Unable to play this recording.')
  const headers = new Headers({
    'Content-Type': file.mimeType,
    'Cache-Control': 'private, no-store',
    'Accept-Ranges': 'bytes',
  })
  for (const key of ['Content-Length', 'Content-Range']) {
    const value = response.headers.get(key)
    if (value) headers.set(key, value)
  }
  return new Response(response.body, { status: response.status, headers })
}
