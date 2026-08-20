import { describe, expect, it, vi } from 'vitest'

import { APIError } from 'payload'

import {
  populateRockFormName,
  resolveRockFormSelection,
  RockForms,
  validateRegistrationPath,
  validateRockFormSlug,
  validateWorkflowTypeGuid,
} from './RockForms'

describe('RockForms collection', () => {
  it('groups launcher content and exposes the requested content contract', () => {
    expect(RockForms.admin).toMatchObject({
      group: 'Launcher',
      useAsTitle: 'title',
      defaultColumns: ['title', 'formType', 'slug', 'published', 'updatedAt'],
    })

    const fields = new Map(
      RockForms.fields
        .filter((field) => 'name' in field)
        .map((field) => [field.name, field]),
    )

    expect(fields.get('title')).toMatchObject({ type: 'text', required: true })
    expect(fields.get('formType')).toMatchObject({
      type: 'select',
      required: true,
      defaultValue: 'workflow',
    })
    expect(fields.get('slug')).toMatchObject({
      type: 'text',
      required: true,
      unique: true,
      index: true,
    })
    expect(fields.get('image')).toMatchObject({ type: 'upload', relationTo: 'media' })
    expect(fields.get('body')).toMatchObject({ type: 'richText' })
    expect(fields.get('workflowTypeGuid')).toMatchObject({
      type: 'text',
      unique: true,
      index: true,
      admin: {
        components: {
          Field: '@/components/admin/RockWorkflowPicker#RockWorkflowPicker',
        },
      },
    })
    expect(fields.get('rockFormName')).toMatchObject({
      type: 'text',
      admin: { readOnly: true },
    })
    expect(fields.get('registrationPath')).toMatchObject({
      type: 'text',
      unique: true,
      index: true,
      maxLength: 128,
    })
    expect(fields.get('published')).toMatchObject({
      type: 'checkbox',
      defaultValue: false,
    })
  })

  it('accepts shareable URL keys and rejects reserved launcher targets', () => {
    expect(validateRockFormSlug('kids-enrolment')).toBe(true)
    expect(validateRockFormSlug('Kids Enrolment')).toBeTypeOf('string')
    expect(validateRockFormSlug('123')).toBeTypeOf('string')
    expect(validateRockFormSlug('give')).toBeTypeOf('string')
  })

  it('requires only the field used by the selected form type', () => {
    expect(validateWorkflowTypeGuid(null, { siblingData: { formType: 'registrationPage' } })).toBe(true)
    expect(validateRegistrationPath('kids', { siblingData: { formType: 'registrationPage' } })).toBe(true)
    expect(validateRegistrationPath('admin/users', { siblingData: { formType: 'registrationPage' } })).toBeTypeOf('string')
    expect(validateRegistrationPath(null, { siblingData: { formType: 'workflow' } })).toBe(true)
  })

  it('resolves and stores the selected live Rock form name', async () => {
    const lookup = vi.fn().mockResolvedValue({
      guid: '11111111-1111-1111-1111-111111111111',
      name: 'Kids enrolment',
    })

    await expect(
      resolveRockFormSelection(
        { requestedGuid: '11111111-1111-1111-1111-111111111111' },
        lookup,
      ),
    ).resolves.toEqual({
      guid: '11111111-1111-1111-1111-111111111111',
      name: 'Kids enrolment',
    })
    expect(lookup).toHaveBeenCalledOnce()
  })

  it('preserves a stored name without requiring Rock for an unchanged selection', async () => {
    const lookup = vi.fn()
    await expect(
      resolveRockFormSelection(
        {
          requestedGuid: '11111111-1111-1111-1111-111111111111',
          previousGuid: '11111111-1111-1111-1111-111111111111',
          previousName: 'Kids enrolment',
        },
        lookup,
      ),
    ).resolves.toEqual({
      guid: '11111111-1111-1111-1111-111111111111',
      name: 'Kids enrolment',
    })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('rejects a workflow that is no longer publicly selectable', async () => {
    await expect(
      resolveRockFormSelection(
        { requestedGuid: '11111111-1111-1111-1111-111111111111' },
        async () => null,
      ),
    ).rejects.toBeInstanceOf(APIError)
  })

  it('stores a validated Registration site path without workflow fields', async () => {
    await expect(
      populateRockFormName({
        data: {
          formType: 'registrationPage',
          registrationPath: 'kids',
          workflowTypeGuid: '11111111-1111-1111-1111-111111111111',
          rockFormName: 'Old workflow',
        },
      } as unknown as Parameters<typeof populateRockFormName>[0]),
    ).resolves.toMatchObject({
      formType: 'registrationPage',
      registrationPath: 'kids',
      workflowTypeGuid: null,
      rockFormName: null,
    })
  })

  it('rejects unsafe Registration site paths', async () => {
    await expect(
      populateRockFormName({
        data: { formType: 'registrationPage', registrationPath: 'admin/users' },
      } as unknown as Parameters<typeof populateRockFormName>[0]),
    ).rejects.toBeInstanceOf(APIError)
  })
})
