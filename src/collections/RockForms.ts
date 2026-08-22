import { APIError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { isEditor } from '@/access/roles'
import { createCacheInvalidationHook } from '@/hooks/revalidateCacheTags'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { isEligibleRockConnectionSignup } from '@/lib/rock-connection-signups/server'
import { isGuid } from '@/lib/rock-forms/constants'
import { validateRegistrationPagePath } from '@/lib/rock-forms/registration-page'
import { getPublicRockWorkflow } from '@/lib/rock-forms/server'

const RESERVED_LAUNCHER_TARGETS = new Set([
  'catalogue',
  'connect',
  'feedback',
  'give',
  'home',
  'visit',
])

export function validateRockFormSlug(value: unknown): true | string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)) {
    return 'Start with a lowercase letter and use only lowercase letters, numbers, and single hyphens.'
  }
  if (RESERVED_LAUNCHER_TARGETS.has(value)) {
    return 'This URL key is reserved by the launcher.'
  }
  return true
}

export function validateWorkflowTypeGuid(
  value: unknown,
  { siblingData }: { siblingData?: Record<string, unknown> },
): true | string {
  if (siblingData?.formType && siblingData.formType !== 'workflow') return true
  return typeof value === 'string' && isGuid(value)
    ? true
    : 'Enter the workflow type GUID from Rock.'
}

export function validateConnectionBlockGuid(
  value: unknown,
  { siblingData }: { siblingData?: Record<string, unknown> },
): true | string {
  if (siblingData?.formType !== 'connectionOpportunity') return true
  return typeof value === 'string' && isGuid(value)
    ? true
    : 'Choose an eligible Rock Connection Signup configuration.'
}

export function validateRegistrationPath(
  value: unknown,
  { siblingData }: { siblingData?: Record<string, unknown> },
): true | string {
  return siblingData?.formType === 'registrationPage'
    ? validateRegistrationPagePath(value)
    : true
}

type RockFormOption = { guid: string; name: string }

export async function resolveConnectionBlockGuid(
  value: unknown,
  isEligible: (guid: string) => Promise<boolean> = isEligibleRockConnectionSignup,
): Promise<string> {
  if (typeof value !== 'string' || !isGuid(value)) {
    throw new APIError('Choose an eligible Rock Connection Signup configuration.', 400)
  }
  const guid = value.toLowerCase()
  try {
    if (!(await isEligible(guid))) {
      throw new APIError(
        'This Rock Connection Signup is no longer eligible. Choose a replacement before publishing.',
        400,
      )
    }
    return guid
  } catch (error) {
    if (error instanceof APIError) throw error
    throw new APIError(
      'Unable to verify this Rock Connection Signup. Try publishing again after Rock discovery recovers.',
      503,
    )
  }
}

export async function resolveRockFormSelection(
  {
    requestedGuid,
    previousGuid,
    previousName,
  }: {
    requestedGuid: unknown
    previousGuid?: unknown
    previousName?: unknown
  },
  lookup: (guid: string) => Promise<RockFormOption | null> = getPublicRockWorkflow,
): Promise<RockFormOption | null> {
  if (typeof requestedGuid !== 'string' || !isGuid(requestedGuid)) return null
  const guid = requestedGuid.toLowerCase()
  if (
    typeof previousGuid === 'string' &&
    previousGuid.toLowerCase() === guid &&
    typeof previousName === 'string' &&
    previousName.trim()
  ) {
    return { guid, name: previousName.trim() }
  }

  try {
    const form = await lookup(guid)
    if (!form) {
      throw new APIError(
        'Choose an active, public Rock Form Builder workflow.',
        400,
      )
    }
    return { guid: form.guid.toLowerCase(), name: form.name.trim() }
  } catch (error) {
    if (error instanceof APIError) throw error
    throw new APIError('Unable to verify the selected Rock form right now.', 503)
  }
}

export const populateRockFormName: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
}) => {
  const formType = data?.formType ?? originalDoc?.formType ?? 'workflow'
  if (formType === 'registrationPage') {
    const requestedPath = data?.registrationPath ?? originalDoc?.registrationPath
    const registrationPath = typeof requestedPath === 'string'
      ? requestedPath.trim().toLowerCase()
      : requestedPath
    const validation = validateRegistrationPagePath(registrationPath)
    if (validation !== true) throw new APIError(validation, 400)
    return {
      ...data,
      formType,
      registrationPath,
      workflowTypeGuid: null,
      rockFormName: null,
      connectionBlockGuid: null,
    }
  }

  if (formType === 'connectionOpportunity') {
    const requestedGuid = data?.connectionBlockGuid ?? originalDoc?.connectionBlockGuid
    const previousGuid = originalDoc?.connectionBlockGuid
    const isUnpublishingExistingSelection =
      data?.published === false &&
      typeof requestedGuid === 'string' &&
      typeof previousGuid === 'string' &&
      isGuid(requestedGuid) &&
      requestedGuid.toLowerCase() === previousGuid.toLowerCase()
    const connectionBlockGuid = isUnpublishingExistingSelection
      ? requestedGuid.toLowerCase()
      : await resolveConnectionBlockGuid(requestedGuid)
    return {
      ...data,
      formType,
      registrationPath: null,
      workflowTypeGuid: null,
      rockFormName: null,
      connectionBlockGuid,
    }
  }

  const selection = await resolveRockFormSelection({
    requestedGuid: data?.workflowTypeGuid ?? originalDoc?.workflowTypeGuid,
    previousGuid: originalDoc?.workflowTypeGuid,
    previousName: originalDoc?.rockFormName,
  })
  if (!selection) {
    throw new APIError('Choose an active, public Rock Form Builder workflow.', 400)
  }
  return {
    ...data,
    formType: 'workflow',
    registrationPath: null,
    workflowTypeGuid: selection.guid,
    rockFormName: selection.name,
    connectionBlockGuid: null,
  }
}

export const RockForms: CollectionConfig = {
  slug: 'rock-forms',
  labels: {
    singular: 'Rock Form',
    plural: 'Rock Forms',
  },
  admin: {
    group: 'Launcher',
    useAsTitle: 'title',
    defaultColumns: ['title', 'formType', 'slug', 'published', 'updatedAt'],
    description: 'Rock workflows, Connection Opportunities, and Registration site pages opened inside the website launcher.',
  },
  access: {
    read: isEditor,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  hooks: {
    beforeValidate: [populateRockFormName],
    afterChange: [createCacheInvalidationHook(CACHE_TAGS.rockForms)],
    afterDelete: [createCacheInvalidationHook(CACHE_TAGS.rockForms)],
  },
  fields: [
    {
      name: 'formType',
      label: 'Form type',
      type: 'select',
      required: true,
      defaultValue: 'workflow',
      options: [
        { label: 'Rock workflow', value: 'workflow' },
        { label: 'Connection Opportunity', value: 'connectionOpportunity' },
        { label: 'Registration page', value: 'registrationPage' },
      ],
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: 'URL key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      maxLength: 128,
      validate: validateRockFormSlug,
      admin: {
        description: 'Open this form with ?launcher=url-key.',
        position: 'sidebar',
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Optional 16:9 banner shown above the form.',
      },
    },
    {
      name: 'body',
      label: 'Introductory content',
      type: 'richText',
      admin: {
        description: 'Optional content shown between the banner and the Rock form.',
      },
    },
    {
      name: 'workflowTypeGuid',
      label: 'Rock Form ID',
      type: 'text',
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? value.trim().toLowerCase() : value,
        ],
      },
      validate: validateWorkflowTypeGuid,
      admin: {
        description: 'The workflow type GUID for the Rock entry form.',
        condition: (_, siblingData) => siblingData?.formType === 'workflow',
        components: {
          Field: '@/components/admin/RockWorkflowPicker#RockWorkflowPicker',
        },
      },
    },
    {
      name: 'rockFormName',
      label: 'Rock form name',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'The current Rock form name saved for the collection list.',
        condition: (_, siblingData) => siblingData?.formType === 'workflow',
      },
    },
    {
      name: 'connectionBlockGuid',
      label: 'Rock Connection Signup',
      type: 'text',
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? value.trim().toLowerCase() : value,
        ],
      },
      validate: validateConnectionBlockGuid,
      admin: {
        description: 'An active public Connection Opportunity Signup configuration that is safe for Ev Church.',
        condition: (_, siblingData) => siblingData?.formType === 'connectionOpportunity',
        components: {
          Field: '@/components/admin/RockConnectionSignupPicker#RockConnectionSignupPicker',
        },
      },
    },
    {
      name: 'registrationPath',
      label: 'Registration page path',
      type: 'text',
      unique: true,
      index: true,
      maxLength: 128,
      validate: validateRegistrationPath,
      hooks: {
        beforeValidate: [
          ({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value,
        ],
      },
      admin: {
        description: 'The path after registration.ev.church, for example kids.',
        condition: (_, siblingData) => siblingData?.formType === 'registrationPage',
      },
    },
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Published forms appear in the launcher and can be opened by URL.',
        position: 'sidebar',
      },
    },
  ],
}
