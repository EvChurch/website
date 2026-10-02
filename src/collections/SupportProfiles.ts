import type { Access, CollectionConfig } from 'payload'
import { hasExactPayloadAdminRole, isAdmin } from '@/access/roles'
import { createCacheInvalidationHook } from '@/hooks/revalidateCacheTags'
import { CACHE_TAGS } from '@/lib/cache-tags'

const publicProfiles: Access = ({ req }) => hasExactPayloadAdminRole(req.user && 'roles' in req.user ? req.user : null) ? true : { published: { equals: true } }

export const SupportProfiles: CollectionConfig = {
  slug: 'support-profiles',
  admin: { group: 'Giving', useAsTitle: 'name', defaultColumns: ['name', 'group', 'email', 'published'], description: 'Shared profiles for About and personal giving links. Link each person from their giving fund.' },
  access: { read: publicProfiles, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    beforeChange: [({ data, originalDoc }) => {
      const profile = { ...originalDoc, ...data }
      if (profile.published && (!profile.photo || !profile.blurb?.trim() || !profile.email?.trim())) {
        throw new Error('Published support profiles need a photo, blurb, and email address.')
      }
      return data
    }],
    afterChange: [createCacheInvalidationHook(CACHE_TAGS.supportProfiles)],
    afterDelete: [createCacheInvalidationHook(CACHE_TAGS.supportProfiles)],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, validate: (value: string | null | undefined) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || 'Use lowercase words separated by hyphens.' },
    { name: 'group', type: 'select', required: true, options: [{ label: 'Apprentice', value: 'apprentices' }, { label: 'Student minister', value: 'student-ministers' }] },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'blurb', type: 'textarea' },
    { name: 'email', type: 'email', admin: { description: 'Published contact address and recipient for completed BlinkPay giving notifications.' } },
    { name: 'published', type: 'checkbox', required: true, defaultValue: false, index: true },
    { name: 'sortOrder', type: 'number', required: true, defaultValue: 0 },
  ],
}
