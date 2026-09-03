import type { CollectionConfig } from 'payload'
import { denyExternalMutation, isAdmin } from '@/access/roles'
import { givingAdmin, readOnlyGivingFields } from './givingAdmin'

export const GivingCancellationFeedback: CollectionConfig = {
  slug: 'giving-cancellation-feedback',
  admin: givingAdmin(
    'reason',
    ['createdAt','giver','schedule','reason','note','operation'],
    'Optional member feedback submitted after a recurring gift cancellation.',
  ),
  access: {
    read: isAdmin,
    create: denyExternalMutation,
    update: denyExternalMutation,
    delete: denyExternalMutation,
  },
  fields: readOnlyGivingFields([
    { name: 'contextKey', type: 'text', required: true, index: true, admin: { readOnly: true } },
    { name: 'environment', type: 'select', required: true, options: ['sandbox','production'], index: true, admin: { readOnly: true } },
    { name: 'synthetic', type: 'checkbox', required: true, index: true, admin: { readOnly: true } },
    { name: 'schedule', type: 'relationship', relationTo: 'giving-schedules', required: true, index: true, admin: { readOnly: true } },
    { name: 'giver', type: 'relationship', relationTo: 'giving-givers', required: true, index: true, admin: { readOnly: true } },
    { name: 'operation', type: 'relationship', relationTo: 'giving-provider-operations', required: true, unique: true, admin: { readOnly: true } },
    { name: 'memberRockPersonId', type: 'number', required: true, index: true, admin: { readOnly: true } },
    { name: 'memberRockPersonAliasId', type: 'number', required: true, index: true, admin: { readOnly: true } },
    { name: 'memberAuth0Subject', type: 'text', required: true, admin: { readOnly: true } },
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: [
        { label: 'I’m changing the details of my giving', value: 'changing_details' },
        { label: 'My circumstances have changed', value: 'circumstances_changed' },
        { label: 'I set this up by mistake', value: 'mistake' },
        { label: 'I’d rather not say', value: 'prefer_not_to_say' },
        { label: 'Other', value: 'other' },
      ],
      index: true,
      admin: { readOnly: true },
    },
    { name: 'note', type: 'textarea', maxLength: 500, admin: { readOnly: true } },
  ]),
}
