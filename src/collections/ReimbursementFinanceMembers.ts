import type { CollectionConfig } from 'payload'

import { denyExternalMutation, isAdmin } from '@/access/roles'

/** Only current active memberships of Rock's finance security roles. */
export const ReimbursementFinanceMembers: CollectionConfig = {
  slug: 'reimbursement-finance-members',
  admin: {
    group: 'Reimbursements',
    useAsTitle: 'name',
    defaultColumns: ['name', 'rockGroupName', 'lastSyncedAt'],
  },
  access: {
    read: isAdmin,
    create: denyExternalMutation,
    update: denyExternalMutation,
    delete: denyExternalMutation,
  },
  fields: [
    { name: 'rockMembershipId', type: 'number', required: true, unique: true, min: 1 },
    { name: 'rockGroupId', type: 'number', required: true, min: 1, index: true },
    { name: 'rockGroupName', type: 'text', required: true },
    { name: 'rockPersonId', type: 'number', required: true, min: 1, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email' },
    { name: 'lastSyncedAt', type: 'date', required: true, admin: { readOnly: true } },
  ],
}
