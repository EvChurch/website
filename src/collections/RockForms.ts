import { APIError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { isEditor } from '@/access/roles'
import { createCacheInvalidationHook } from '@/hooks/revalidateCacheTags'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { isGuid } from '@/lib/rock-forms/constants'
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

type RockFormOption = { guid: string; name: string }

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
  const selection = await resolveRockFormSelection({
    requestedGuid: data?.workflowTypeGuid ?? originalDoc?.workflowTypeGuid,
    previousGuid: originalDoc?.workflowTypeGuid,
    previousName: originalDoc?.rockFormName,
  })
  if (!selection) return data
  return {
    ...data,
    workflowTypeGuid: selection.guid,
    rockFormName: selection.name,
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
    defaultColumns: ['title', 'rockFormName', 'slug', 'published', 'updatedAt'],
    description: 'Content and Rock workflows opened inside the website launcher.',
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
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? value.trim().toLowerCase() : value,
        ],
      },
      validate: (value: unknown) =>
        typeof value === 'string' && isGuid(value)
          ? true
          : 'Enter the workflow type GUID from Rock.',
      admin: {
        description: 'The workflow type GUID for the Rock entry form.',
        components: {
          Field: '@/components/admin/RockWorkflowPicker#RockWorkflowPicker',
        },
      },
    },
    {
      name: 'rockFormName',
      label: 'Rock form name',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'The current Rock form name saved for the collection list.',
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
