import type { RockFormSchema } from './types'

export const CONTACT_WORKFLOW_GUID = '874418b5-a477-4382-94dc-38060b005bfa'
export const BUDGETING_INTEREST_MESSAGE =
  "I'm interested in the more thorough 4–8 week budgeting course. Please let me know when details are available."

export function contactInterestValues(schema: RockFormSchema, search: string): Record<string, string> {
  const values = schema.initialFieldValues
  if (schema.workflowTypeGuid.toLowerCase() !== CONTACT_WORKFLOW_GUID
    || new URLSearchParams(search).get('interest') !== 'budgeting-course') return values

  const message = schema.fields.find(field => field.attribute.key === 'Message')
  if (!message || values[message.attribute.attributeGuid]) return values
  return { ...values, [message.attribute.attributeGuid]: BUDGETING_INTEREST_MESSAGE }
}
