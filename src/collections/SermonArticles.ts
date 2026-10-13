import type { CollectionConfig } from 'payload'
import { isAdmin, isSermonManager, adminOnlyField } from '@/access/roles'

/** Private editorial state. Only the workflow can mutate it. */
export const SermonArticles: CollectionConfig = {
  slug: 'sermon-articles',
  admin: { group: 'Sermons', useAsTitle: 'title', defaultColumns: ['title', 'author', 'status', 'error'] },
  access: { read: isSermonManager, create: () => false, update: () => false, delete: isAdmin },
  fields: [
    { name: 'sermon', type: 'relationship', relationTo: 'sermons', required: true, unique: true },
    { name: 'production', type: 'relationship', relationTo: 'sermon-productions', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'author', type: 'text', required: true },
    { name: 'reviewEmail', type: 'email', required: true, access: { read: adminOnlyField } },
    { name: 'rockPersonId', type: 'number', required: true },
    { name: 'series', type: 'relationship', relationTo: 'sermon-series' },
    { name: 'passageReference', type: 'text' },
    { name: 'audio', type: 'upload', relationTo: 'sermon-work-files' },
    { name: 'status', type: 'select', required: true, defaultValue: 'transcribing', options: ['transcribing', 'drafting', 'review', 'published', 'failed'], index: true },
    { name: 'transcript', type: 'textarea' },
    { name: 'krispImportStartedAt', type: 'date', access: { read: adminOnlyField } },
    { name: 'reviewReadyAt', type: 'date' },
    { name: 'krispImportId', type: 'text', access: { read: adminOnlyField } },
    { name: 'krispUploadUrl', type: 'text', access: { read: adminOnlyField } },
    { name: 'krispUploadExpiresAt', type: 'date', access: { read: adminOnlyField } },
    { name: 'krispUploaded', type: 'checkbox', defaultValue: false },
    { name: 'blocks', type: 'json' },
    { name: 'questions', type: 'json' },
    { name: 'revision', type: 'text', required: true },
    { name: 'leaseToken', type: 'text', access: { read: adminOnlyField } },
    { name: 'leaseExpiresAt', type: 'date', access: { read: adminOnlyField } },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'error', type: 'text' },
    { name: 'reviewSentAt', type: 'date' },
    { name: 'blogPost', type: 'relationship', relationTo: 'blog-posts' },
  ],
}
