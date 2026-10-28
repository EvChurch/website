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
    { name: 'rockId', type: 'number', unique: true, min: 1 },
    { name: 'rockGuid', type: 'text', unique: true },
    { name: 'isLocal', type: 'checkbox', required: true, defaultValue: false, admin: { readOnly: true, description: 'Managed by the website rather than Rock.' } },
    { name: 'financeOnly', type: 'checkbox', required: true, defaultValue: false, admin: { readOnly: true } },
    { name: 'name', type: 'text', required: true },
    { name: 'sortOrder', type: 'number', required: true, defaultValue: 0 },
    { name: 'isActive', type: 'checkbox', required: true, defaultValue: false, index: true },
    { name: 'approverPersonAliasGuid', type: 'text' },
    {
      name: 'approverRockPersonId', type: 'number', min: 1, index: true,
      admin: { description: 'Ordinary purposes require an assigned approver. Finance-only purposes go directly to finance.' },
    },
    { name: 'approverName', type: 'text' },
    { name: 'approverEmail', type: 'email' },
    { name: 'lastSyncedAt', type: 'date', required: true, admin: { readOnly: true } },
  ],
}
