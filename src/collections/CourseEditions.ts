import type { Access, CollectionConfig } from 'payload'
const deny: Access = () => false

/** Published teaching only. Participant answers never belong in an edition. */
export const CourseEditions: CollectionConfig = {
  slug: 'course-editions', admin: { hidden: true },
  access: { read: deny, create: deny, update: deny, delete: deny },
  fields: [
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true, index: true },
    { name: 'structureKey', type: 'text', required: true, index: true },
    { name: 'snapshot', type: 'json', required: true },
    { name: 'publishedAt', type: 'date', required: true },
  ],
}
