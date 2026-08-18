import type { GlobalConfig } from 'payload'

import { isEditor } from '@/access/roles'

/** Durable marker for the last fully committed Service Guide snapshot. */
export const ServiceGuideSyncState: GlobalConfig = {
  slug: 'service-guide-sync-state',
  label: 'Service Guide Sync State',
  admin: {
    group: 'Launcher',
  },
  access: {
    read: isEditor,
    update: () => false,
  },
  fields: [
    { name: 'lastSuccessfulSyncAt', type: 'date', admin: { readOnly: true } },
    { name: 'itemCount', type: 'number', required: true, defaultValue: 0, admin: { readOnly: true } },
    { name: 'diagnosticCount', type: 'number', required: true, defaultValue: 0, admin: { readOnly: true } },
  ],
}
