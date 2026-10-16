export const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ROCK_ENTRY_FORM_COMPONENT_URL =
  '/Obsidian/Blocks/Workflow/WorkflowEntry/Actions/entryForm.obs'

export const ROCK_SIGNATURE_COMPONENT_URL =
  '/Obsidian/Blocks/Workflow/WorkflowEntry/Actions/electronicSignature.obs'

export const MEMBERSHIP_WORKFLOW_TYPE_GUID =
  '23c2fe1e-c030-4d65-a5e8-29a6c24ae441'

export const ROCK_FORM_START_ACTION = 'rock_form_start'
export const ROCK_FORM_SUBMIT_ACTION = 'rock_form_submit'

export function isGuid(value: string): boolean {
  return GUID_PATTERN.test(value)
}
