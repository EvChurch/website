import type { Access, CollectionConfig } from 'payload'
const deny: Access = () => false

export const CourseGroups: CollectionConfig = {
  slug: 'course-groups', admin: { hidden: true },
  access: { read: deny, create: deny, update: deny, delete: deny },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'edition', type: 'relationship', relationTo: 'course-editions', required: true, index: true },
    { name: 'facilitatorKey', type: 'text', required: true, index: true },
    { name: 'status', type: 'select', options: ['active', 'closed'], required: true, defaultValue: 'active' },
  ],
}
