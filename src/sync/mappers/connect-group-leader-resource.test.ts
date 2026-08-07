import { describe, expect, it } from 'vitest'

import { mapRockConnectGroupLeaderResource } from './connect-group-leader-resource'

describe('mapRockConnectGroupLeaderResource', () => {
  it('maps the inspected Rock Content Channel 24 contract', () => {
    const mapped = mapRockConnectGroupLeaderResource({
      Id: 24,
      Guid: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
      Title: '  Hebrews Study 3  ',
      Content: '<p>Fallback content</p>',
      Status: 1,
      StartDateTime: '2026-08-02T00:00:00+12:00',
      ExpireDateTime: '2026-08-08T23:59:59+12:00',
      Priority: 8,
      Order: 3,
      AttributeValues: {
        Campus: {
          Value: 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB, bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        },
        YouTubeURL: { Value: ' https://www.youtube.com/watch?v=example ' },
        PromotionalImage: { Value: 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC' },
        Description: { Value: " God's promised rest remains. " },
        Host1: {
          Value: 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
          ValueFormatted: ' Ryan Green ',
        },
        Host2: {
          Value: 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE',
          PersistedTextValue: ' Man Long Cheung ',
        },
        BibleReference: { Value: ' Hebrews 3:7–4:13 ' },
        Resource1File: {
          Value: 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
          PersistedTextValue: ' Leader Notes.pdf ',
        },
        Resource2File: {
          Value: '11111111-1111-1111-1111-111111111111',
          PersistedTextValue: ' Member Study.docx ',
        },
      },
    })

    expect(mapped).toEqual({
      rockId: 24,
      rockGuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Hebrews Study 3',
      status: 1,
      startDateTime: '2026-08-02T00:00:00+12:00',
      expireDateTime: '2026-08-08T23:59:59+12:00',
      campusGuids: ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
      youtubeUrl: 'https://www.youtube.com/watch?v=example',
      promotionalImageGuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      description: "God's promised rest remains.",
      hosts: [
        {
          personAliasGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          name: 'Ryan Green',
        },
        {
          personAliasGuid: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          name: 'Man Long Cheung',
        },
      ],
      bibleReference: 'Hebrews 3:7–4:13',
      leaderNotesFile: {
        guid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        name: 'Leader Notes.pdf',
      },
      memberStudyFile: {
        guid: '11111111-1111-1111-1111-111111111111',
        name: 'Member Study.docx',
      },
      priority: 8,
      sourceOrder: 3,
    })
  })

  it('falls back to item content and omits malformed optional values', () => {
    expect(
      mapRockConnectGroupLeaderResource({
        Id: 1,
        Title: 'Simple',
        Content: ' Item description ',
        Status: 0,
        StartDateTime: null,
        AttributeValues: {
          PromotionalImage: { Value: 'not-a-guid' },
          Host1: { Value: 'not-a-guid', ValueFormatted: 'Unlinked host' },
        },
      }),
    ).toMatchObject({
      rockGuid: null,
      description: 'Item description',
      promotionalImageGuid: null,
      hosts: [{ personAliasGuid: null, name: 'Unlinked host' }],
      leaderNotesFile: null,
      memberStudyFile: null,
      priority: 0,
      sourceOrder: 0,
    })
  })
})
