import type { Access, CollectionConfig } from 'payload'
const deny: Access = () => false

export const CourseInvitations: CollectionConfig = {
  slug: 'course-invitations', admin: { hidden: true },
  access: { read: deny, create: deny, update: deny, delete: deny },
  fields: [
    { name: 'group', type: 'relationship', relationTo: 'course-groups', required: true, index: true },
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'inviterKey', type: 'text', required: true, index: true },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'status', type: 'select', options: ['pending', 'accepted', 'revoked'], required: true, defaultValue: 'pending' },
    { name: 'deliveryStatus', type: 'select', options: ['sending', 'sent', 'unknown'], required: true, defaultValue: 'sending' },
    { name: 'providerId', type: 'text' },
  ],
}
