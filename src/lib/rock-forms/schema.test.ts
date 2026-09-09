import { afterEach, describe, expect, it } from 'vitest'
import {
  defaultPersonEntryValues,
  parseRockInteractiveAction,
  replaceApiPersonDefaults,
} from './schema'
import { buildRockFormSchema } from './server'

describe('Rock entry form schema', () => {
  afterEach(() => {
    delete process.env.ROCK_FORM_SIGNING_SECRET
  })

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

  it('provides blank person values when Rock omits person-entry defaults', () => {
    expect(defaultPersonEntryValues()).toEqual({
      person: {},
      spouse: null,
      campusGuid: null,
      maritalStatusGuid: null,
      address: null,
    })
  })

  it('keeps person entry renderable when Rock starts with null person defaults', async () => {
    process.env.ROCK_FORM_SIGNING_SECRET = 'test-only-secret'

    const result = await buildRockFormSchema({
      workflow: {
        guid: '431c6d57-c022-49ac-9930-633f73cfed73',
        name: 'Serving Survey',
      },
      sessionGuid: '11111111-1111-4111-8111-111111111111',
      interactionGuid: '22222222-2222-4222-8222-222222222222',
      action: {
        workflowGuid: '33333333-3333-4333-8333-333333333333',
        actionTypeGuid: 'c59ecc64-16e6-46f6-9a28-e8f74ff111c6',
        actionStartDateTime: '2026-08-31T13:24:59.973',
        actionData: {
          componentUrl:
            '/Obsidian/Blocks/Workflow/WorkflowEntry/Actions/entryForm.obs',
          componentConfiguration: {
            sections: '[]',
            fields: '[]',
            personEntry: JSON.stringify({
              isCampusVisible: true,
              genderOption: 0,
              emailOption: 2,
              mobilePhoneOption: 2,
              isSmsVisible: false,
              addressOption: 0,
              maritalStatusOption: 0,
              birthDateOption: 1,
              spouseOption: 0,
              raceOption: 0,
              ethnicityOption: 0,
            }),
            buttons: '[{"action":"Submit","title":"Submit"}]',
          },
          componentData: {
            fieldValues: '{}',
            personEntryValues: 'null',
          },
        },
      },
    })

    expect(result.personEntry).not.toBeNull()
    expect(result.initialPersonEntryValues).toEqual(defaultPersonEntryValues())
  })

  it('rejects non-entry workflow actions', () => {
    expect(() =>
      parseRockInteractiveAction({ noActionMessage: 'Already complete' }),
    ).toThrow('Already complete')
  })
})

describe('Connect Group context binding', () => {
  it('keeps the selected group in the encrypted context and omits group choices from the response', async () => {
    process.env.ROCK_FORM_SIGNING_SECRET = 'test-only-secret'
    const { verifyRockFormContextToken } = await import('./context-token')
    const { CONNECT_GROUP_FIELD_GUID, CONNECT_GROUP_WORKFLOW_GUID } = await import('@/lib/connect-groups/constants')
    const connectGroupGuid = '11111111-1111-4111-8111-111111111111'
    try {
      const form = await buildRockFormSchema({
        workflow: { guid: CONNECT_GROUP_WORKFLOW_GUID, name: 'Join a Connect Group' },
        sessionGuid: 'session', interactionGuid: 'interaction', connectGroupGuid,
        action: {
          actionTypeGuid: 'action', actionStartDateTime: '2026-09-10T00:00:00Z',
          actionData: {
            componentConfiguration: {
              fields: JSON.stringify([{ attribute: { attributeGuid: CONNECT_GROUP_FIELD_GUID, fieldTypeGuid: 'type', name: 'Group', key: 'Group', configurationValues: { options: 'Private fixture group' } } }]),
              buttons: '[{"action":"Submit","title":"Submit"}]',
            },
            componentData: { fieldValues: JSON.stringify({ [CONNECT_GROUP_FIELD_GUID]: connectGroupGuid }) },
          },
        },
      })
      expect(form.fields).toEqual([])
      expect(JSON.stringify(form)).not.toContain('Private fixture group')
      expect(verifyRockFormContextToken(form.contextToken).connectGroupGuid).toBe(connectGroupGuid)
    } finally {
      delete process.env.ROCK_FORM_SIGNING_SECRET
    }
  })
})
