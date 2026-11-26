import type { Access, CollectionConfig } from 'payload'
const deny: Access = () => false

/** Access is checked by course services, never by general collection APIs. */
export const CourseAnswers: CollectionConfig = {
  slug: 'course-answers', admin: { hidden: true },
  access: { read: deny, create: deny, update: deny, delete: deny },
  fields: [
    { name: 'responseKey', type: 'text', required: true, unique: true, index: true },
    { name: 'attempt', type: 'relationship', relationTo: 'course-attempts', required: true, index: true },
    { name: 'edition', type: 'relationship', relationTo: 'course-editions', required: true, index: true },
    { name: 'lessonId', type: 'text', required: true },
    { name: 'blockId', type: 'text', required: true },
    { name: 'ownerKey', type: 'text', required: true, index: true },
    { name: 'scope', type: 'select', options: ['personal', 'individual-shared', 'group'], required: true },
    { name: 'value', type: 'json' },
    { name: 'revision', type: 'number', required: true, defaultValue: 1, min: 1 },
  ],
}
