import { randomUUID } from 'node:crypto'
import { rockFetch } from '@/lib/rock-api'
import {
  getTurnstileSiteKey,
  ROCK_FORM_BLOCK_GUID,
  ROCK_FORM_CONTEXT_TTL_SECONDS,
  ROCK_FORM_PAGE_GUID,
} from './config'
export { verifyTurnstileToken } from '@/lib/turnstile'
import { createRockFormContextToken } from './context-token'
import { isGuid } from './constants'
import { parseRockInteractiveAction, replaceApiPersonDefaults } from './schema'
import type {
  RockFormContext,
  RockFormSchema,
  RockInteractiveAction,
  RockPersonEntryValues,
  RockListItem,
  RockWorkflowOption,
} from './types'

type RockWorkflowType = {
  Guid: string
  Name: string
  IsActive: boolean
  IsFormBuilder: boolean
  IsLoginRequired: boolean
}

function escapeODataString(value: string): string {
  return value.replaceAll("'", "''")
}

export async function listPublicRockForms(): Promise<RockWorkflowOption[]> {
  const workflows = await rockFetch<RockWorkflowType[]>({
    endpoint: 'WorkflowTypes',
    params: {
      '$filter':
        'IsActive eq true and IsFormBuilder eq true and IsLoginRequired eq false',
      '$select': 'Guid,Name,IsActive,IsFormBuilder,IsLoginRequired',
      '$orderby': 'Name',
    },
  })

  return workflows.map((workflow) => ({
    guid: workflow.Guid.toLowerCase(),
    name: workflow.Name,
  }))
}

export async function getPublicRockWorkflow(
  workflowTypeGuid: string,
): Promise<RockWorkflowOption | null> {
  if (!isGuid(workflowTypeGuid)) return null

  const workflows = await rockFetch<RockWorkflowType[]>({
    endpoint: 'WorkflowTypes',
    params: {
      '$filter': `Guid eq guid'${escapeODataString(workflowTypeGuid)}' and IsActive eq true and IsFormBuilder eq true and IsLoginRequired eq false`,
      '$select': 'Guid,Name,IsActive,IsFormBuilder,IsLoginRequired',
      '$top': '1',
    },
  })
  const workflow = workflows[0]

  return workflow
    ? {
        guid: workflow.Guid.toLowerCase(),
        name: workflow.Name,
      }
    : null
}

type WorkflowEntryRequest = {
  context: { sessionGuid: string; interactionGuid: string }
  workflowGuid?: string | null
  actionTypeGuid?: string | null
  actionStartDateTime?: string | null
  componentData?: Record<string, string> | null
}

async function callWorkflowEntry(
  workflowTypeGuid: string,
  request: WorkflowEntryRequest,
): Promise<RockInteractiveAction> {

  return rockFetch<RockInteractiveAction>({
    endpoint: `v2/BlockActions/${ROCK_FORM_PAGE_GUID}/${ROCK_FORM_BLOCK_GUID}/GetNextInteractiveAction`,
    method: 'POST',
    body: {
      __context: {
        pageParameters: { WorkflowTypeGuid: workflowTypeGuid },
        ...request.context,
      },
      workflowGuid: request.workflowGuid ?? null,
      actionTypeGuid: request.actionTypeGuid ?? null,
      actionStartDateTime: request.actionStartDateTime ?? null,
      componentData: request.componentData ?? null,
    },
    retries: 0,
  })
}

export async function startRockForm(
  workflowTypeGuid: string,
): Promise<RockFormSchema> {
  const workflow = await getPublicRockWorkflow(workflowTypeGuid)

  if (!workflow) {
    throw new Error('This Rock form is not available for public website use')
  }

  const sessionGuid = randomUUID()
  const interactionGuid = randomUUID()
  const action = await callWorkflowEntry(workflow.guid, {
    context: { sessionGuid, interactionGuid },
  })

  return buildRockFormSchema({ workflow, action, sessionGuid, interactionGuid })
}

export function buildRockFormSchema({
  workflow,
  action,
  sessionGuid,
  interactionGuid,
  clearPersonDefaults = true,
}: {
  workflow: RockWorkflowOption
  action: RockInteractiveAction
  sessionGuid: string
  interactionGuid: string
  clearPersonDefaults?: boolean
}): RockFormSchema {
  const parsed = parseRockInteractiveAction(action)
  if (parsed.buttons.length === 0) {
    throw new Error('Rock did not provide an action for this form')
  }
  const initialPersonEntryValues = clearPersonDefaults
    ? replaceApiPersonDefaults(parsed.initialPersonEntryValues)
    : parsed.initialPersonEntryValues
  const allowedFields = parsed.fields.map((field) => {
    const rawBinaryFileType =
      field.attribute.configurationValues.binaryFileType || ''
    let binaryFileTypeGuid = rawBinaryFileType
    try {
      binaryFileTypeGuid =
        (JSON.parse(rawBinaryFileType) as { value?: string }).value || ''
    } catch {
      // Rock uses either a GUID or a serialized ListItemBag here.
    }

    return {
      attributeGuid: field.attribute.attributeGuid.toLowerCase(),
      fieldTypeGuid: field.attribute.fieldTypeGuid.toLowerCase(),
      binaryFileTypeGuid,
      securityGrantToken:
        field.securityGrantToken ||
        field.attribute.securityGrantToken ||
        null,
      name: field.attribute.name,
    }
  })
  const context: RockFormContext = {
    version: 1,
    workflowTypeGuid: workflow.guid,
    workflowGuid: action.workflowGuid || null,
    sessionGuid,
    interactionGuid,
    actionTypeGuid: parsed.actionTypeGuid,
    actionStartDateTime: parsed.actionStartDateTime,
    initialFieldValues: parsed.initialFieldValues,
    allowedFields,
    buttonTitles: parsed.buttons.map((button) => button.title),
    expiresAt: Date.now() + ROCK_FORM_CONTEXT_TTL_SECONDS * 1000,
  }

  return {
    workflowTypeGuid: workflow.guid,
    workflowName: workflow.name,
    headerHtml: parsed.headerHtml,
    footerHtml: parsed.footerHtml,
    sections: parsed.sections,
    fields: parsed.fields,
    personEntry: parsed.personEntry,
    initialFieldValues: parsed.initialFieldValues,
    initialPersonEntryValues,
    buttons: parsed.buttons,
    contextToken: createRockFormContextToken(context),
    turnstileSiteKey: getTurnstileSiteKey(),
  }
}

export async function uploadRockFormFile({
  file,
  binaryFileTypeGuid,
  securityGrantToken,
}: {
  file: File
  binaryFileTypeGuid: string
  securityGrantToken?: string | null
}): Promise<Pick<RockListItem, 'value' | 'text'>> {
  if (!isGuid(binaryFileTypeGuid)) {
    throw new Error('Rock did not provide a valid file type')
  }

  const rockBaseUrl = (process.env.ROCK_API_URL || 'https://rock.ev.church/api')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '')
  const url = new URL(`${rockBaseUrl}/FileUploader.ashx`)
  url.searchParams.set('isBinaryFile', 'True')
  url.searchParams.set('fileTypeGuid', binaryFileTypeGuid)
  url.searchParams.set('isTemporary', 'True')
  if (securityGrantToken) {
    url.searchParams.set('SecurityGrantToken', securityGrantToken)
  }

  const body = new FormData()
  body.set('file', file)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization-Token': process.env.ROCK_API_KEY || '' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) {
    throw new Error(`Rock rejected the file upload (${response.status})`)
  }

  const result = (await response.json()) as { Guid?: string; FileName?: string }
  if (!result.Guid || !result.FileName) {
    throw new Error('Rock did not return the uploaded file details')
  }

  return { value: result.Guid, text: result.FileName }
}

export async function submitRockForm({
  context,
  fieldValues,
  personEntryValues,
  button,
}: {
  context: RockFormContext
  fieldValues: Record<string, string>
  personEntryValues: RockPersonEntryValues | null
  button: string
}): Promise<{ action: RockInteractiveAction; workflow: RockWorkflowOption }> {
  const workflow = await getPublicRockWorkflow(context.workflowTypeGuid)
  if (!workflow) {
    throw new Error('This Rock form is no longer available')
  }

  const action = await callWorkflowEntry(workflow.guid, {
    context: {
      sessionGuid: context.sessionGuid,
      interactionGuid: context.interactionGuid,
    },
    workflowGuid: context.workflowGuid,
    actionTypeGuid: context.actionTypeGuid,
    actionStartDateTime: context.actionStartDateTime,
    componentData: {
      fieldValues: JSON.stringify(fieldValues),
      personEntryValues: JSON.stringify(personEntryValues),
      button,
    },
  })

  return { action, workflow }
}
