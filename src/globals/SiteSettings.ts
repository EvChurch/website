import type { GlobalConfig } from 'payload'
import { contentLeadOnlyField, isContentLead } from '@/access/roles'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
    update: isContentLead,
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
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'bannerCopy',
          label: 'Banner copy',
          type: 'text',
          required: true,
          defaultValue: 'Help us improve the new ev.church.',
          maxLength: 160,
        },
        {
          name: 'ctaLabel',
          label: 'CTA label',
          type: 'text',
          required: true,
          defaultValue: 'Share feedback.',
          maxLength: 80,
        },
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
          name: 'dismissalVersion',
          label: 'Dismissal version',
          type: 'text',
          required: true,
          defaultValue: 'v1',
          maxLength: 100,
          admin: {
            description: 'Change this value to show the feedback banner again after dismissal.',
          },
        },
        {
          name: 'endDate',
          label: 'End date',
          type: 'date',
          admin: {
            description: 'Optional date and time after which the feedback banner is hidden.',
            date: { pickerAppearance: 'dayAndTime' },
          },
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
