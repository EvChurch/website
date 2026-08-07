import type { CollectionConfig } from 'payload'

import { denyExternalMutation, isEditor } from '@/access/roles'

/**
 * A read-only mirror of Rock's Service Guide content channel.
 *
 * The sync uses Payload's Local API with access overrides. Keeping request-scoped
 * mutations disabled prevents the mirror from acquiring a second source of truth.
 */
export const ServiceGuideItems: CollectionConfig = {
  slug: 'service-guide-items',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'priority', 'sourceOrder', 'lastSyncedAt'],
  },
  access: {
    read: isEditor,
    create: denyExternalMutation,
    update: denyExternalMutation,
    delete: denyExternalMutation,
  },
  fields: [
    {
      name: 'rockId',
      type: 'number',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'rockGuid',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'textarea' },
    { name: 'promotionalBlurb', type: 'textarea' },
    { name: 'bannerImageGuid', type: 'text' },
    { name: 'status', type: 'number', required: true, index: true },
    { name: 'startDateTime', type: 'date', index: true },
    { name: 'expireDateTime', type: 'date', index: true },
    { name: 'priority', type: 'number', required: true, defaultValue: 0, index: true },
    { name: 'sourceOrder', type: 'number', required: true, defaultValue: 0, index: true },
    {
      name: 'campusGuids',
      type: 'array',
      admin: { readOnly: true },
      fields: [{ name: 'guid', type: 'text', required: true }],
    },
    {
      name: 'campuses',
      type: 'relationship',
      relationTo: 'campuses',
      hasMany: true,
      index: true,
    },
    { name: 'directLink', type: 'text' },
    { name: 'workflowGuid', type: 'text', index: true },
    { name: 'connectionOpportunityGuid', type: 'text', index: true },
    { name: 'connectionBlockGuid', type: 'text', index: true },
    { name: 'eventGuid', type: 'text', index: true },
    { name: 'event', type: 'relationship', relationTo: 'events', index: true },
    {
      name: 'lastSyncedAt',
      type: 'date',
      required: true,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
