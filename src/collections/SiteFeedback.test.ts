import { describe, expect, it } from 'vitest'

import { SiteFeedback } from './SiteFeedback'

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
            { label: 'Resolved', value: 'resolved' },
            { label: 'Won\u2019t fix', value: 'wont-fix' },
          ],
        }),
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

  it('makes every delivery field read-only in Admin', () => {
    const deliveryFields = SiteFeedback.fields.filter(
      (field) =>
        'name' in field &&
        typeof field.name === 'string' &&
        field.name.startsWith('notification'),
    )

    expect(deliveryFields.length).toBeGreaterThanOrEqual(8)
    for (const field of deliveryFields) {
      expect(field.admin).toMatchObject({ readOnly: true })
    }
  })
})
