import type { CollectionConfig } from 'payload'

import { isContentLead } from '@/access/roles'

export const SiteFeedback: CollectionConfig = {
  slug: 'feedback-submissions',
  admin: {
    useAsTitle: 'comment',
    defaultColumns: ['comment', 'email', 'sourceUrl', 'createdAt'],
  },
  access: {
    create: isContentLead,
    read: isContentLead,
    update: isContentLead,
    delete: isContentLead,
  },
  fields: [
    {
      name: 'comment',
      label: 'Comment',
      type: 'textarea',
      required: true,
      maxLength: 4_000,
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
    },
    {
      name: 'sourceUrl',
      label: 'Page URL',
      type: 'text',
      required: true,
      maxLength: 2_048,
    },
    {
      name: 'clientAddressDigest',
      label: 'Client address digest',
      type: 'text',
      required: true,
      maxLength: 128,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'userAgent',
      label: 'User agent',
      type: 'text',
      maxLength: 512,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'notificationStatus',
      label: 'Notification status',
      type: 'select',
      required: true,
      defaultValue: 'disabled',
      index: true,
      options: [
        { label: 'Disabled', value: 'disabled' },
        { label: 'Pending', value: 'pending' },
        { label: 'Sending', value: 'sending' },
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationRecipient',
      label: 'Intended notification recipient',
      type: 'email',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationAttemptCount',
      label: 'Notification attempts',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationWindowStartedAt',
      label: 'Notification recovery window started',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationLastAttemptAt',
      label: 'Last notification attempt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationLeaseToken',
      label: 'Notification lease token',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true, hidden: true },
    },
    {
      name: 'notificationLeaseExpiresAt',
      label: 'Notification lease expiry',
      type: 'date',
      index: true,
      admin: { position: 'sidebar', readOnly: true, hidden: true },
    },
    {
      name: 'notificationSentAt',
      label: 'Notification sent',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationProviderId',
      label: 'Notification provider ID',
      type: 'text',
      maxLength: 256,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notificationError',
      label: 'Notification failure',
      type: 'textarea',
      maxLength: 200,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
