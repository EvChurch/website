import type { GlobalConfig } from 'payload'
import { contentLeadOnlyField, isContentLead } from '@/access/roles'
import { createCacheInvalidationHook } from '@/hooks/revalidateCacheTags'
import { CACHE_TAGS } from '@/lib/cache-tags'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
    update: isContentLead,
  },
  hooks: {
    afterChange: [createCacheInvalidationHook(CACHE_TAGS.siteSettings)],
  },
  fields: [
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'socialLinks',
      type: 'array',
      fields: [
        {
          name: 'platform',
          type: 'select',
          options: [
            { label: 'Facebook', value: 'facebook' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'Spotify', value: 'spotify' },
            { label: 'Apple Podcasts', value: 'apple-podcasts' },
          ],
        },
        {
          name: 'url',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'contactEmail',
      type: 'email',
    },
    {
      name: 'mailingAddress',
      type: 'textarea',
    },
    {
      name: 'analyticsId',
      type: 'text',
      admin: {
        description: 'Google Analytics measurement ID',
      },
    },
    {
      name: 'feedback',
      label: 'Site Feedback',
      type: 'group',
      fields: [
        {
          name: 'modalTitle',
          label: 'Modal title',
          type: 'text',
          required: true,
          defaultValue: 'Share your feedback',
          maxLength: 120,
        },
        {
          name: 'modalIntro',
          label: 'Modal introduction',
          type: 'textarea',
          required: true,
          defaultValue: 'Tell us what is working well or what we could improve.',
          maxLength: 500,
        },
        {
          name: 'notificationRecipient',
          label: 'Notification recipient',
          type: 'email',
          defaultValue: 'tataihono@ev.church',
          access: {
            read: contentLeadOnlyField,
          },
          admin: {
            description:
              'New feedback is emailed to this address. Clear it to disable notifications.',
          },
        },
      ],
    },
  ],
}
