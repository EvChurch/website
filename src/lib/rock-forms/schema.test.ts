import { describe, expect, it } from 'vitest'
import { parseRockInteractiveAction, replaceApiPersonDefaults } from './schema'

describe('Rock entry form schema', () => {
  it('parses Rock serialized configuration and data', () => {
    const result = parseRockInteractiveAction({
      actionTypeGuid: 'action-guid',
      actionStartDateTime: '2026-08-03T10:00:00+12:00',
      actionData: {
        componentUrl: '/Obsidian/Blocks/Workflow/WorkflowEntry/Actions/entryForm.obs',
        componentConfiguration: {
          headerHtml: '<p>Hello</p>',
          footerHtml: '',
          sections: '[{"id":"section"}]',
          fields:
            '[{"attribute":{"attributeGuid":"field","fieldTypeGuid":"type","name":"Message","key":"Message","configurationValues":{}}}]',
          personEntry: '{"isCampusVisible":false,"emailOption":2}',
          buttons: '[{"action":"Primary","title":"Submit"}]',
        },
        componentData: {
          fieldValues: '{"field":""}',
          personEntryValues: '{"person":{"lastName":"Website Sync"}}',
        },
      },
    })

    expect(result.fields[0]?.attribute.name).toBe('Message')
    expect(result.personEntry?.emailOption).toBe(2)
    expect(result.initialFieldValues).toEqual({ field: '' })
  })

  it('removes the API-key person identity before exposing defaults', () => {
    const result = replaceApiPersonDefaults({
      person: { lastName: 'Website Sync', email: 'sync@example.com' },
      campusGuid: 'campus-guid',
      maritalStatusGuid: 'status-guid',
      address: { street1: 'Private' },
    })

    expect(result?.person.lastName).toBeNull()
    expect(result?.person.email).toBeNull()
    expect(result?.campusGuid).toBeNull()
    expect(result?.address).toBeNull()
  })

  it('rejects non-entry workflow actions', () => {
    expect(() =>
      parseRockInteractiveAction({ noActionMessage: 'Already complete' }),
    ).toThrow('Already complete')
  })
})
