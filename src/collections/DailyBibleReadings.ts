import type { Access, CollectionConfig } from 'payload'

import { denyExternalMutation, hasPayloadAdminRole } from '@/access/roles'
import type { User } from '@/payload-types'

export const readPublishedDailyBibleReadings: Access = ({ req: { user } }) => {
  if (hasPayloadAdminRole(user as User | null)) return true
  return { isPublished: { equals: true } }
}

/** Published, plain-text snapshots imported from sent Rock communications. */
export const DailyBibleReadings: CollectionConfig = {
  slug: 'daily-bible-readings',
  admin: {
    useAsTitle: 'sourceName',
    defaultColumns: ['sourceDate', 'passageReference', 'rockSentAt', 'isPublished'],
  },
  access: {
    read: readPublishedDailyBibleReadings,
    create: denyExternalMutation,
    update: denyExternalMutation,
    delete: denyExternalMutation,
  },
  fields: [
    { name: 'rockId', type: 'number', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'rockGuid', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'sourceName', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'subject', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'rockSentAt', type: 'date', required: true, index: true, admin: { readOnly: true } },
    { name: 'sourceDate', type: 'date', required: true, index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayOnly' } } },
    { name: 'openingScripture', type: 'textarea', required: true, admin: { readOnly: true } },
    { name: 'passageReference', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'passageText', type: 'textarea', required: true, admin: { readOnly: true } },
    {
      name: 'passageProvider',
      type: 'select',
      options: [{ label: 'API.Bible', value: 'api-bible' }],
      admin: { readOnly: true },
    },
    { name: 'bibleVersionId', type: 'text', admin: { readOnly: true } },
    { name: 'bibleVersionAbbreviation', type: 'text', admin: { readOnly: true } },
    { name: 'bibleVersionTitle', type: 'text', admin: { readOnly: true } },
    { name: 'apiBiblePassageId', type: 'text', admin: { readOnly: true } },
    { name: 'apiBibleFumsToken', type: 'text', admin: { readOnly: true } },
    { name: 'bibleCopyright', type: 'textarea', admin: { readOnly: true } },
    { name: 'scriptureFetchedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'questions',
      type: 'array',
      admin: { readOnly: true },
      fields: [{ name: 'text', type: 'textarea', required: true }],
    },
    {
      name: 'prayerPrompts',
      type: 'array',
      admin: { readOnly: true },
      fields: [{ name: 'text', type: 'textarea', required: true }],
    },
    { name: 'isPublished', type: 'checkbox', required: true, defaultValue: true, index: true, admin: { readOnly: true } },
    { name: 'importedAt', type: 'date', required: true, admin: { readOnly: true } },
  ],
}
