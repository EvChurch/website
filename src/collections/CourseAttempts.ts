import type { Access, CollectionConfig } from 'payload'
const deny: Access = () => false

/** Account-owned records; only course server functions may access these. */
export const CourseAttempts: CollectionConfig = {
  slug: 'course-attempts', admin: { hidden: true },
  access: { read: deny, create: deny, update: deny, delete: deny },
  indexes: [{ fields: ['group', 'accountKey'], unique: true }],
  fields: [
    { name: 'group', type: 'relationship', relationTo: 'course-groups', index: true },
    { name: 'membershipStatus', type: 'select', options: ['active', 'left', 'removed'], defaultValue: 'active', required: true },
    { name: 'displayName', type: 'text' },
    { name: 'accountEmail', type: 'text' },
    { name: 'accountKey', type: 'text', required: true, index: true },
    { name: 'edition', type: 'relationship', relationTo: 'course-editions', required: true, index: true },
    { name: 'mode', type: 'select', options: ['solo', 'group'], required: true, defaultValue: 'solo' },
    { name: 'completedLessonIds', type: 'json', required: true, defaultValue: [] },
    { name: 'completedAt', type: 'date', index: true },
  ],
}
