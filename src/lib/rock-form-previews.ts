import { unstable_cache } from 'next/cache'

import { initializeRockConnectionSignup } from './rock-connection-signups/server'
import type { RockConnectionSignupSchema } from './rock-connection-signups/types'
import { startRockForm } from './rock-forms/server'
import type { RockFormSchema } from './rock-forms/types'

const loadWorkflowPreview = unstable_cache(
  async (workflowTypeGuid: string): Promise<RockFormSchema> => {
    const schema = await startRockForm(workflowTypeGuid)
    return {
      ...schema,
      contextToken: '',
      fields: schema.fields.map((field) => ({
        ...field,
        securityGrantToken: null,
        attribute: {
          ...field.attribute,
          securityGrantToken: null,
        },
      })),
    }
  },
  ['rock-form-preview'],
  { revalidate: 300 },
)

const loadConnectionPreview = unstable_cache(
  async (
    blockGuid: string,
  ): Promise<Omit<RockConnectionSignupSchema, 'sessionGuid' | 'interactionGuid'>> => {
    const schema = await initializeRockConnectionSignup(blockGuid)
    const { sessionGuid: _sessionGuid, interactionGuid: _interactionGuid, ...preview } =
      schema
    return preview
  },
  ['rock-connection-signup-preview'],
  { revalidate: 300 },
)

export async function getRockFormPreview(workflowTypeGuid: string) {
  return loadWorkflowPreview(workflowTypeGuid)
}

export async function getRockConnectionSignupPreview(blockGuid: string) {
  return loadConnectionPreview(blockGuid)
}
