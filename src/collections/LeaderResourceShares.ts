import type { Access, CollectionConfig } from 'payload'

const deny: Access = () => false

/** Server-only capability records for sharing one current leader resource. */
export const LeaderResourceShares: CollectionConfig = {
  slug: 'leader-resource-shares',
  admin: { hidden: true, useAsTitle: 'pairKey' },
  access: { read: deny, create: deny, update: deny, delete: deny },
  fields: [
    { name: 'token', type: 'text', required: true, unique: true, index: true },
    { name: 'pairKey', type: 'text', required: true, unique: true, index: true },
    { name: 'resourceRockId', type: 'number', required: true, index: true },
    { name: 'sharerRockPersonId', type: 'number', required: true, index: true },
  ],
}
