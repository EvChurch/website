import { describe, expect, it } from 'vitest'

import { SiteFeedback, validateDuplicateReference } from './SiteFeedback'

function accessArgs(roles?: string[]) {
  return { req: { user: roles === undefined ? null : { roles } } } as never
}

describe('SiteFeedback collection', () => {
  it('uses the plural feedback submissions slug', () => {
    expect(SiteFeedback.slug).toBe('feedback-submissions')
  })

  it('allows only admins and content leads to manage submissions', async () => {
    for (const operation of ['create', 'read', 'update', 'delete'] as const) {
      const rule = SiteFeedback.access?.[operation]
      expect(typeof rule).toBe('function')
      if (typeof rule !== 'function') continue

      expect(await rule(accessArgs(['admin']))).toBe(true)
      expect(await rule(accessArgs(['content-lead']))).toBe(true)
      expect(await rule(accessArgs(['editor']))).toBe(false)
      expect(await rule(accessArgs(['member']))).toBe(false)
      expect(await rule(accessArgs([]))).toBe(false)
      expect(await rule(accessArgs())).toBe(false)
    }
  })

  it('defines the bounded submission and server-owned metadata contract', () => {
    expect(SiteFeedback.admin).toMatchObject({
      defaultColumns: [
        'resolutionStatus',
        'comment',
        'email',
        'sourceUrl',
        'postHogReplayUrl',
        'createdAt',
      ],
      useAsTitle: 'comment',
    })

    expect(SiteFeedback.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'comment',
          type: 'textarea',
          required: true,
          maxLength: 4_000,
        }),
        expect.objectContaining({ name: 'email', type: 'email', required: true }),
        expect.objectContaining({
          name: 'resolutionStatus',
          type: 'select',
          defaultValue: 'new',
          required: true,
          index: true,
          options: [
            { label: 'New', value: 'new' },
            { label: 'Planned', value: 'planned' },
            { label: 'In progress', value: 'in-progress' },
            { label: 'Needs approval', value: 'needs-approval' },
            { label: 'Resolved', value: 'resolved' },
            { label: 'Duplicate', value: 'duplicate' },
            { label: 'Won\u2019t fix', value: 'wont-fix' },
          ],
        }),
        expect.objectContaining({
          name: 'classification',
          type: 'select',
          index: true,
        }),
        expect.objectContaining({ name: 'risk', type: 'select' }),
        expect.objectContaining({ name: 'requesterRank', type: 'select' }),
        expect.objectContaining({ name: 'areaRelevance', type: 'select' }),
        expect.objectContaining({ name: 'priority', type: 'select', index: true }),
        expect.objectContaining({ name: 'recommendation', type: 'select' }),
        expect.objectContaining({
          name: 'requesterTeamMember',
          type: 'relationship',
          relationTo: 'team-members',
        }),
        expect.objectContaining({
          name: 'duplicateOf',
          type: 'relationship',
          relationTo: 'feedback-submissions',
          index: true,
        }),
        expect.objectContaining({ name: 'triagedAt', type: 'date', index: true }),
        expect.objectContaining({ name: 'deliveryPhase', type: 'select', index: true }),
        expect.objectContaining({
          name: 'sourceUrl',
          type: 'text',
          required: true,
          maxLength: 2_048,
        }),
        expect.objectContaining({
          name: 'clientAddressDigest',
          type: 'text',
          required: true,
          maxLength: 128,
        }),
        expect.objectContaining({
          name: 'userAgent',
          type: 'text',
          maxLength: 512,
        }),
        expect.objectContaining({
          name: 'notificationStatus',
          type: 'select',
          defaultValue: 'disabled',
          required: true,
        }),
        expect.objectContaining({
          name: 'notificationRecipient',
          type: 'email',
        }),
        expect.objectContaining({
          name: 'notificationAttemptCount',
          type: 'number',
          defaultValue: 0,
          required: true,
        }),
        expect.objectContaining({
          name: 'postHogSessionId',
          type: 'text',
          maxLength: 64,
        }),
        expect.objectContaining({
          name: 'postHogReplayUrl',
          type: 'text',
          maxLength: 2_048,
          admin: expect.objectContaining({
            readOnly: true,
            components: expect.objectContaining({
              Field: '@/components/admin/PostHogReplayLink',
            }),
          }),
        }),
      ]),
    )
  })

  it('requires a canonical reference only for duplicates and prevents chains', async () => {
    expect(
      validateDuplicateReference(null, {
        siblingData: { classification: 'duplicate', resolutionStatus: 'duplicate' },
      }),
    ).toMatch(/canonical/i)
    expect(
      validateDuplicateReference(42, {
        siblingData: { resolutionStatus: 'new' },
      }),
    ).toMatch(/only allowed/i)
    expect(
      validateDuplicateReference({ id: 42 }, {
        id: 42,
        siblingData: { classification: 'duplicate', resolutionStatus: 'duplicate' },
      }),
    ).toMatch(/itself/i)
    await expect(
      validateDuplicateReference(41, {
        id: 42,
        siblingData: { classification: 'duplicate', resolutionStatus: 'duplicate' },
        req: {
          payload: {
            findByID: async () => ({ classification: 'bug', resolutionStatus: 'new' }),
          },
        },
      }),
    ).resolves.toBe(true)
    await expect(
      validateDuplicateReference(41, {
        id: 42,
        siblingData: { classification: 'duplicate', resolutionStatus: 'duplicate' },
        req: {
          payload: {
            findByID: async () => ({
              classification: 'duplicate',
              resolutionStatus: 'duplicate',
            }),
          },
        },
      }),
    ).resolves.toMatch(/canonical/i)
    expect(
      validateDuplicateReference(41, {
        id: 42,
        siblingData: { classification: 'duplicate', resolutionStatus: 'new' },
      }),
    ).toMatch(/set together/i)
  })

  it('makes every notification field read-only in Admin', () => {
    const notificationFields = SiteFeedback.fields.filter(
      (field) =>
        'name' in field &&
        typeof field.name === 'string' &&
        field.name.startsWith('notification'),
    )

    expect(notificationFields.length).toBeGreaterThanOrEqual(8)
    for (const field of notificationFields) {
      expect(field.admin).toMatchObject({ readOnly: true })
    }
  })

  it('makes every delivery checkpoint read-only in Admin', () => {
    const expectedNames = [
      'deliveryKind',
      'deliveryPhase',
      'deliveryRunId',
      'deliveryBranch',
      'deliveryPrUrl',
      'deliveryMergeCommit',
      'deliveryDeploymentId',
      'deliveryVerificationResult',
      'deliveryLastVerifiedAt',
      'deliveryFailureNote',
    ]
    const fieldsByName = new Map(
      SiteFeedback.fields
        .filter((field) => 'name' in field && typeof field.name === 'string')
        .map((field) => [('name' in field ? field.name : ''), field]),
    )

    for (const name of expectedNames) {
      expect(fieldsByName.get(name)?.admin).toMatchObject({ readOnly: true })
    }
  })
})
