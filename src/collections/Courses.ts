import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'
import { isContentLead, isEditor } from '@/access/roles'
import { courseQuestionBlock, coursePromptBlock } from '@/lib/courses/question-blocks'
import { publishCourseEdition } from '@/lib/courses/publishing'

export const Courses: CollectionConfig = {
  slug: 'courses',
  admin: {
    useAsTitle: 'title', defaultColumns: ['title', '_status', 'enrolmentOpen'],
    preview: (doc) => `/members/courses/${doc.slug}/preview`,
  },
  access: { read: isEditor, create: isContentLead, update: isEditor, delete: isContentLead },
  versions: { drafts: true },
  hooks: { afterChange: [publishCourseEdition] },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, validate: (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || 'Use lowercase words separated by hyphens.' },
    { name: 'summary', type: 'textarea', required: true },
    { name: 'enrolmentOpen', type: 'checkbox', defaultValue: true },
    { name: 'allowSolo', type: 'checkbox', defaultValue: true },
    { name: 'allowGroup', type: 'checkbox', defaultValue: true },
    { name: 'lessons', type: 'array', required: true, minRows: 1, fields: [
      { name: 'lessonId', type: 'text', required: true, defaultValue: () => randomUUID(), admin: { readOnly: true } },
      { name: 'title', type: 'text', required: true },
      { name: 'required', type: 'checkbox', defaultValue: true },
      { name: 'blocks', type: 'blocks', blocks: [
        courseQuestionBlock, coursePromptBlock,
        { slug: 'courseTeaching', interfaceName: 'CourseTeachingBlock', fields: [{ name: 'body', type: 'richText', required: true }] },
        { slug: 'courseImage', interfaceName: 'CourseImageBlock', fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }, { name: 'caption', type: 'text' }] },
        { slug: 'courseVideo', interfaceName: 'CourseVideoBlock', fields: [{ name: 'url', type: 'text', required: true, validate: (value: unknown) => { try { return typeof value === 'string' && new URL(value).protocol === 'https:' || 'Use an HTTPS video link.' } catch { return 'Use an HTTPS video link.' } } }, { name: 'title', type: 'text', required: true }] },
      ] },
    ] },
  ],
}
