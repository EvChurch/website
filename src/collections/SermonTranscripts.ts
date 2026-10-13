import type { CollectionConfig } from 'payload'
import { isAdmin, isSermonManager, adminOnlyField } from '@/access/roles'

export const SermonTranscripts: CollectionConfig = {
  slug: 'sermon-transcripts',
  admin: { group: 'Sermons', useAsTitle: 'title', defaultColumns: ['title', 'status', 'error'] },
  access: { read: isSermonManager, create: () => false, update: () => false, delete: isAdmin },
  fields: [
    { name: 'sermon', type: 'relationship', relationTo: 'sermons', required: true, index: true },
    { name: 'production', type: 'relationship', relationTo: 'sermon-productions', required: true, unique: true },
    { name: 'publishedAudio', type: 'relationship', relationTo: 'sermon-audio', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'status', type: 'select', required: true, defaultValue: 'transcribing', options: ['transcribing', 'tagging', 'complete', 'superseded', 'failed'], index: true },
    { name: 'audio', type: 'upload', relationTo: 'sermon-work-files' },
    { name: 'transcript', type: 'textarea' },
    { name: 'segments', type: 'json' },
    { name: 'audioOffset', type: 'number', defaultValue: 0 },
    { name: 'krispImportStartedAt', type: 'date', access: { read: adminOnlyField } },
    { name: 'krispImportId', type: 'text', access: { read: adminOnlyField } },
    { name: 'krispUploadUrl', type: 'text', access: { read: adminOnlyField } },
    { name: 'krispUploadExpiresAt', type: 'date', access: { read: adminOnlyField } },
    { name: 'krispUploaded', type: 'checkbox', defaultValue: false },
    { name: 'leaseToken', type: 'text', access: { read: adminOnlyField } },
    { name: 'leaseExpiresAt', type: 'date', access: { read: adminOnlyField } },
    { name: 'error', type: 'text' },
  ],
}
