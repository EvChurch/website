import type { Access, CollectionConfig } from 'payload'

const deny: Access = () => false

/** Private service-only storage for short-lived giving drafts and capability digests. */
export const GivingDrafts: CollectionConfig = {
  slug: 'giving-drafts',
  admin: { hidden: true, useAsTitle: 'purpose' },
  access: { read: deny, create: deny, update: deny, delete: deny },
  fields: [
    { name: 'tokenDigest', type: 'text', required: true, unique: true, index: true },
    { name: 'bindingDigest', type: 'text', required: true, index: true },
    { name: 'purpose', type: 'select', required: true, options: ['giving-draft-resume-v1', 'giving-draft-session-v1'], index: true },
    { name: 'audience', type: 'select', required: true, options: ['guest', 'member'], index: true },
    { name: 'answers', type: 'json', required: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'consumedAt', type: 'date', index: true },
  ],
}
