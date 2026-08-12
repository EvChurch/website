import { describe, expect, it } from 'vitest'

import { SiteSettings } from './SiteSettings'

function accessArgs(roles?: string[]) {
  return { req: { user: roles === undefined ? null : { roles } } } as never
}

describe('SiteSettings global', () => {
  it('stays public to read and restricts edits to admins and content leads', async () => {
    const read = SiteSettings.access?.read
    const update = SiteSettings.access?.update

    expect(typeof read).toBe('function')
    expect(typeof update).toBe('function')
    if (typeof read !== 'function' || typeof update !== 'function') return

    expect(await read(accessArgs())).toBe(true)
    expect(await read(accessArgs(['editor']))).toBe(true)
    expect(await update(accessArgs(['admin']))).toBe(true)
    expect(await update(accessArgs(['content-lead']))).toBe(true)
    expect(await update(accessArgs(['editor']))).toBe(false)
    expect(await update(accessArgs(['member']))).toBe(false)
    expect(await update(accessArgs())).toBe(false)
  })

  it('defines bounded feedback controls with safe defaults', () => {
    const feedback = SiteSettings.fields.find(
      (field) => 'name' in field && field.name === 'feedback',
    )

    expect(feedback).toMatchObject({ type: 'group' })
    if (!feedback || !('fields' in feedback)) {
      throw new Error('Site Settings feedback group is not configured')
    }

    expect(feedback.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
        }),
        expect.objectContaining({
          name: 'bannerCopy',
          type: 'text',
          defaultValue: 'Help us improve the new ev.church.',
          maxLength: 160,
        }),
        expect.objectContaining({
          name: 'ctaLabel',
          type: 'text',
          defaultValue: 'Share feedback.',
          maxLength: 80,
        }),
        expect.objectContaining({
          name: 'modalTitle',
          type: 'text',
          defaultValue: 'Share your feedback',
          maxLength: 120,
        }),
        expect.objectContaining({
          name: 'modalIntro',
          type: 'textarea',
          defaultValue: 'Tell us what is working well or what we could improve.',
          maxLength: 500,
        }),
        expect.objectContaining({
          name: 'dismissalVersion',
          type: 'text',
          defaultValue: 'v1',
          maxLength: 100,
        }),
        expect.objectContaining({ name: 'endDate', type: 'date' }),
        expect.objectContaining({
          name: 'notificationRecipient',
          type: 'email',
          defaultValue: 'tataihono@ev.church',
        }),
      ]),
    )
  })

  it('keeps the notification recipient private to content leads', async () => {
    const feedback = SiteSettings.fields.find(
      (field) => 'name' in field && field.name === 'feedback',
    )
    if (!feedback || !('fields' in feedback)) {
      throw new Error('Site Settings feedback group is not configured')
    }

    const recipient = feedback.fields.find(
      (field) => 'name' in field && field.name === 'notificationRecipient',
    )
    if (!recipient || !('access' in recipient)) {
      throw new Error('Feedback notification recipient access is not configured')
    }

    const read = recipient.access?.read
    expect(typeof read).toBe('function')
    if (typeof read !== 'function') return

    expect(await read(accessArgs(['admin']))).toBe(true)
    expect(await read(accessArgs(['content-lead']))).toBe(true)
    expect(await read(accessArgs(['editor']))).toBe(false)
    expect(await read(accessArgs())).toBe(false)
  })
})
