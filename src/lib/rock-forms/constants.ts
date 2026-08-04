export const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ROCK_ENTRY_FORM_COMPONENT_URL =
  '/Obsidian/Blocks/Workflow/WorkflowEntry/Actions/entryForm.obs'

export const ROCK_FORM_START_ACTION = 'rock_form_start'
export const ROCK_FORM_SUBMIT_ACTION = 'rock_form_submit'

export function isGuid(value: string): boolean {
  return GUID_PATTERN.test(value)
}
