import type { GlobalConfig } from 'payload'

import { isAdmin } from '@/access/roles'
import { createCacheInvalidationHook } from '@/hooks/revalidateCacheTags'
import { CACHE_TAGS } from '@/lib/cache-tags'

export const GivingSettings: GlobalConfig = {
  slug: 'giving-settings',
  label: 'Giving Settings',
  admin: { group: 'Giving' },
  access: { read: isAdmin, update: isAdmin },
  hooks: { afterChange: [createCacheInvalidationHook(CACHE_TAGS.givingSettings)] },
  fields: [
    { name: 'cardFixedMinor', label: 'Card fixed fee (cents)', type: 'number', required: true, defaultValue: 30, min: 0, max: 10_000, admin: { step: 1, description: 'Confirm your contracted Stripe rate before enabling card giving.' }, validate: (value: unknown) => Number.isSafeInteger(value) || 'Enter whole cents.' },
    { name: 'cardPercentageBasisPoints', label: 'Card percentage fee (basis points)', type: 'number', required: true, defaultValue: 250, min: 0, max: 2_000, admin: { step: 1, description: '100 basis points = 1%. Includes the percentage charged on the added fee.' }, validate: (value: unknown) => Number.isSafeInteger(value) || 'Enter whole basis points.' },
    {
      name: 'transactionFeeMinor',
      label: 'BlinkPay transaction fee (cents)',
      type: 'number',
      required: true,
      defaultValue: 50,
      min: 0,
      max: 10_000,
      admin: {
        description: 'Added to each one-off or recurring BlinkPay charge. Enter 50 for $0.50.',
        step: 1,
      },
      validate(value: unknown) {
        return Number.isSafeInteger(value) && Number(value) >= 0
          ? true
          : 'Enter a whole number of cents greater than or equal to zero.'
      },
    },
  ],
}
