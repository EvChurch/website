import type { CollectionConfig } from 'payload'

import { denyExternalMutation, isAdmin } from '@/access/roles'

/** Rock's reimbursement Expense Category defined values, not ledger categories. */
export const ResponsibilityCentres: CollectionConfig = {
  slug: 'responsibility-centres',
  labels: { singular: 'Purpose', plural: 'Purposes' },
  admin: {
    group: 'Reimbursements',
    useAsTitle: 'name',
    defaultColumns: ['name', 'approverName', 'isActive', 'lastSyncedAt'],
  },
  access: {
    read: isAdmin,
    create: denyExternalMutation,
    update: denyExternalMutation,
    delete: denyExternalMutation,
  },
  fields: [
    { name: 'rockId', type: 'number', required: true, unique: true, min: 1 },
    { name: 'rockGuid', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { name: 'sortOrder', type: 'number', required: true, defaultValue: 0 },
    { name: 'isActive', type: 'checkbox', required: true, defaultValue: false, index: true },
    { name: 'approverPersonAliasGuid', type: 'text' },
    {
      name: 'approverRockPersonId', type: 'number', min: 1, index: true,
      admin: { description: 'A purpose is selectable only when active and an approver is assigned.' },
    },
    { name: 'approverName', type: 'text' },
    { name: 'approverEmail', type: 'email' },
    { name: 'lastSyncedAt', type: 'date', required: true, admin: { readOnly: true } },
  ],
}
