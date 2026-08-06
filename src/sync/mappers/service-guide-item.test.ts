import { describe, expect, it } from 'vitest'

import { mapRockServiceGuideItem } from './service-guide-item'

describe('mapRockServiceGuideItem', () => {
  it('maps the inspected Service Guide contract and preserves competing legacy actions', () => {
    const mapped = mapRockServiceGuideItem({
      Id: 42,
      Guid: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
      Title: '  Generate  ',
      Content: '<p>Custom details</p>',
      Status: 1,
      StartDateTime: '2026-08-01T00:00:00+12:00',
      ExpireDateTime: '2026-09-01T00:00:00+12:00',
      Priority: 7,
      Order: 3,
      AttributeValues: {
        Campuses: {
          Value:
            'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB, cccccccc-cccc-cccc-cccc-cccccccccccc',
        },
        PromotionalBlurb: { Value: 'Find your next step' },
        Image: { Value: '88888888-8888-8888-8888-888888888888' },
        DetailImage: { Value: '99999999-9999-9999-9999-999999999999' },
        DirectLink: { Value: '/generate' },
        Event: { Value: 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD' },
        Workflow: { Value: 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE' },
        ConnectionOpportunity: { Value: 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF' },
        LinkButtonUrl: { Value: 'https://ignored.example' },
        FluroFormId: { Value: 'ignored' },
      },
    })

    expect(mapped).toEqual({
      rockId: 42,
      rockGuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Generate',
      content: '<p>Custom details</p>',
      promotionalBlurb: 'Find your next step',
      bannerImageGuid: '88888888-8888-8888-8888-888888888888',
      status: 1,
      startDateTime: '2026-08-01T00:00:00+12:00',
      expireDateTime: '2026-09-01T00:00:00+12:00',
      priority: 7,
      sourceOrder: 3,
      campusGuids: [
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
      ],
      directLink: '/generate',
      eventGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      workflowGuid: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      connectionOpportunityGuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    })
  })

  it('normalizes missing optional values without inventing an action', () => {
    expect(
      mapRockServiceGuideItem({
        Id: 1,
        Title: 'Simple item',
        Content: null,
        Status: 1,
        StartDateTime: null,
        AttributeValues: {
          Campuses: { Value: '' },
          Workflow: { Value: 'not-a-guid' },
        },
      }),
    ).toMatchObject({
      content: null,
      promotionalBlurb: null,
      bannerImageGuid: null,
      campusGuids: [],
      workflowGuid: null,
      priority: 0,
      sourceOrder: 0,
    })
  })
})
