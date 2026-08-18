import { NextRequest, NextResponse } from 'next/server'
import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import { verifyRockFormContextToken } from '@/lib/rock-forms/context-token'
import {
  isGuid,
  ROCK_ENTRY_FORM_COMPONENT_URL,
  ROCK_FORM_START_ACTION,
  ROCK_FORM_SUBMIT_ACTION,
} from '@/lib/rock-forms/constants'
import { ROCK_FIELD_TYPES } from '@/lib/rock-forms/field-types'
import { isRockFormPublished } from '@/lib/rock-forms/published'
import {
  buildRockFormSchema,
  startRockForm,
  submitRockForm,
  uploadRockFormFile,
  verifyTurnstileToken,
} from '@/lib/rock-forms/server'
import { getTurnstileSiteKey } from '@/lib/rock-forms/config'
import type { RockPersonBasicValues, RockPersonEntryValues } from '@/lib/rock-forms/types'
import { isSameOriginRequest } from '@/lib/request-origin'
import { safeRockWorkflowRedirect } from '@/lib/rock-forms/redirect'
import { TurnstileVerificationError } from '@/lib/turnstile'

export const dynamic = 'force-dynamic'

const FILE_FIELD_GUIDS = new Set<string>([
  ROCK_FIELD_TYPES.file,
  ROCK_FIELD_TYPES.image,
])
const MAX_MULTIPART_BYTES = 17 * 1024 * 1024
const MAX_MULTIPART_ENTRIES = 200
const MAX_MULTIPART_FILES = 10

async function boundedFormData(request: NextRequest): Promise<FormData> {
  const declaredSize = Number(request.headers.get('content-length') || 0)
  if (declaredSize > MAX_MULTIPART_BYTES) {
    throw new Error('Form submission is too large')
  }
  if (!request.body) throw new Error('Invalid form submission')

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > MAX_MULTIPART_BYTES) {
      await reader.cancel()
      throw new Error('Form submission is too large')
    }
    chunks.push(value)
  }

  const boundedRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
  })
  const body = await boundedRequest.formData()
  const entries = [...body.entries()]
  const fileCount = entries.filter(([, value]) => value instanceof File).length
  if (
    entries.length > MAX_MULTIPART_ENTRIES ||
    fileCount > MAX_MULTIPART_FILES
  ) {
    throw new Error('Form submission has too many fields')
  }
  return body
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function parseObject<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

function sanitizePerson(values: RockPersonBasicValues | null | undefined) {
  if (!values) return null

  return {
    firstName: String(values.firstName || '').slice(0, 100) || null,
    nickName: String(values.nickName || '').slice(0, 100) || null,
    lastName: String(values.lastName || '').slice(0, 100) || null,
    personGender:
      values.personGender === 0 ||
      values.personGender === 1 ||
      values.personGender === 2
        ? values.personGender
        : null,
    personRace: typeof values.personRace === 'string' ? values.personRace : null,
    personEthnicity:
      typeof values.personEthnicity === 'string'
        ? values.personEthnicity
        : null,
    personBirthDate:
      typeof values.personBirthDate === 'string'
        ? values.personBirthDate.slice(0, 40)
        : null,
    email: String(values.email || '').slice(0, 254) || null,
    mobilePhoneNumber:
      String(values.mobilePhoneNumber || '').slice(0, 40) || null,
    mobilePhoneCountryCode:
      String(values.mobilePhoneCountryCode || '').slice(0, 8) || null,
    isMessagingEnabled: values.isMessagingEnabled === true,
  }
}

function sanitizePersonEntry(
  values: RockPersonEntryValues | null,
): RockPersonEntryValues | null {
  if (!values) return null

  return {
    person: sanitizePerson(values.person) || {},
    spouse: sanitizePerson(values.spouse),
    campusGuid:
      typeof values.campusGuid === 'string' && isGuid(values.campusGuid)
        ? values.campusGuid
        : null,
    maritalStatusGuid:
      typeof values.maritalStatusGuid === 'string' &&
      isGuid(values.maritalStatusGuid)
        ? values.maritalStatusGuid
        : null,
    address: sanitizeAddress(values.address),
  }
}

function sanitizeAddress(value: Record<string, unknown> | null | undefined) {
  if (!value) return null

  const stringValue = (key: string, maxLength: number) =>
    typeof value[key] === 'string'
      ? String(value[key]).slice(0, maxLength)
      : null

  return {
    street1: stringValue('street1', 200),
    street2: stringValue('street2', 200),
    city: stringValue('city', 100),
    state: stringValue('state', 100),
    postalCode: stringValue('postalCode', 30),
    country: stringValue('country', 100),
    countryGuid:
      typeof value.countryGuid === 'string' && isGuid(value.countryGuid)
        ? value.countryGuid
        : null,
  }
}

function publicSubmissionError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const safeMessages = [
    'Invalid form context',
    'Expired or invalid form context',
    'Form submission is too large',
    'Form submission has too many fields',
    'Invalid form submission',
  ]

  return error instanceof TurnstileVerificationError || safeMessages.includes(message)
    ? { message, status: 400 }
    : { message: 'Unable to submit this form right now', status: 502 }
}

type RouteContext = { params: Promise<{ workflowTypeGuid: string }> }

async function authenticatedPersonId(request: NextRequest): Promise<number | null> {
  try {
    const session = await getAuth0Client().getSession(request)
    return getMemberProfileStateFromSession(session)?.profile.personId ?? null
  } catch {
    return null
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { workflowTypeGuid } = await context.params

  if (!isGuid(workflowTypeGuid)) return jsonError('Invalid form identifier', 400)

  try {
    if (!(await isRockFormPublished(workflowTypeGuid))) {
      return jsonError('This form is not published on the website', 404)
    }
    return NextResponse.json({ turnstileSiteKey: getTurnstileSiteKey() })
  } catch (error) {
    console.error('Unable to start Rock form', error)
    return jsonError('Unable to load this form right now', 502)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return jsonError('Invalid request origin', 403)

  const { workflowTypeGuid } = await context.params
  if (!isGuid(workflowTypeGuid)) return jsonError('Invalid form identifier', 400)

  try {
    const body = await boundedFormData(request)
    const isStart = body.get('intent') === 'start'

    if (!(await isRockFormPublished(workflowTypeGuid))) {
      return jsonError('This form is not published on the website', 404)
    }

    await verifyTurnstileToken({
      token: String(body.get('turnstileToken') || ''),
      remoteIp: request.headers.get('cf-connecting-ip'),
      expectedHostname:
        process.env.NODE_ENV === 'production'
          ? process.env.RAILWAY_PUBLIC_DOMAIN || null
          : null,
      expectedAction:
        process.env.NODE_ENV === 'production'
          ? isStart
            ? ROCK_FORM_START_ACTION
            : ROCK_FORM_SUBMIT_ACTION
          : null,
    })

    if (isStart) {
      return NextResponse.json(
        await startRockForm(workflowTypeGuid, await authenticatedPersonId(request)),
      )
    }

    const contextToken = String(body.get('contextToken') || '')
    const formContext = verifyRockFormContextToken(contextToken)

    if (formContext.workflowTypeGuid !== workflowTypeGuid.toLowerCase()) {
      return jsonError('The form context does not match this form', 400)
    }
    if (
      formContext.personId &&
      formContext.personId !== (await authenticatedPersonId(request))
    ) {
      return jsonError('The signed-in person does not match this form', 403)
    }
    const knownFields = new Map(
      formContext.allowedFields.map((field) => [field.attributeGuid, field]),
    )
    const submittedValues = parseObject<Record<string, unknown>>(
      body.get('fieldValues'),
      {},
    )
    const fieldValues = { ...formContext.initialFieldValues }

    for (const [attributeGuid, value] of Object.entries(submittedValues)) {
      const normalizedGuid = attributeGuid.toLowerCase()
      if (knownFields.has(normalizedGuid) && typeof value === 'string') {
        fieldValues[normalizedGuid] = value.slice(0, 100_000)
      }
    }

    const pendingFiles = [...knownFields].flatMap(([attributeGuid, field]) => {
      if (!FILE_FIELD_GUIDS.has(field.fieldTypeGuid)) return []
      const file = body.get(`file:${attributeGuid}`)
      return file instanceof File && file.size > 0
        ? [{ attributeGuid, field, file }]
        : []
    })
    const oversizedFile = pendingFiles.find(
      ({ file }) => file.size > 15 * 1024 * 1024,
    )
    if (oversizedFile) {
      return jsonError(
        `${oversizedFile.field.name} must be smaller than 15 MB`,
        400,
      )
    }

    const uploadedFiles = await Promise.all(
      pendingFiles.map(async ({ attributeGuid, field, file }) => ({
        attributeGuid,
        uploaded: await uploadRockFormFile({
          file,
          binaryFileTypeGuid: field.binaryFileTypeGuid,
          securityGrantToken: field.securityGrantToken,
        }),
      })),
    )
    for (const { attributeGuid, uploaded } of uploadedFiles) {
      fieldValues[attributeGuid] = JSON.stringify(uploaded)
    }

    const personEntryValues =
      formContext.personId && formContext.hidePersonEntryWhenKnown
      ? sanitizePersonEntry(formContext.knownPersonEntryValues || null)
      : sanitizePersonEntry(
          parseObject<RockPersonEntryValues | null>(
            body.get('personEntryValues'),
            null,
          ),
        )
    const requestedButton = String(body.get('button') || '')
    if (
      !requestedButton ||
      !formContext.buttonTitles.includes(requestedButton)
    ) {
      return jsonError('Choose a valid form action', 400)
    }
    const button = requestedButton
    const { action: result, workflow } = await submitRockForm({
      context: formContext,
      fieldValues,
      personEntryValues,
      button,
    })

    if (
      result.actionData?.componentUrl === ROCK_ENTRY_FORM_COMPONENT_URL
    ) {
      return NextResponse.json({
        status: 'next',
        form: await buildRockFormSchema({
          workflow,
          action: result,
          sessionGuid: formContext.sessionGuid,
          interactionGuid: formContext.interactionGuid,
          personId: formContext.personId,
          clearPersonDefaults: false,
        }),
      })
    }

    const completionMessage = result.actionData?.message
    const isRedirectAction =
      completionMessage?.type === 4 ||
      completionMessage?.type === 'Redirect'
    const requestedRedirect = isRedirectAction
      ? completionMessage?.content || null
      : null
    const requestOrigin =
      request.headers.get('origin') || request.nextUrl.origin
    const redirectUrl = safeRockWorkflowRedirect(
      requestedRedirect,
      requestOrigin,
    )

    return NextResponse.json({
      status: 'complete',
      message:
        (isRedirectAction && !redirectUrl
          ? null
          : completionMessage?.content) ||
        result.noActionMessage ||
        'Thanks. Your form has been submitted.',
      redirectUrl,
    })
  } catch (error) {
    console.error('Unable to submit Rock form', error)
    const response = publicSubmissionError(error)
    return jsonError(response.message, response.status)
  }
}
