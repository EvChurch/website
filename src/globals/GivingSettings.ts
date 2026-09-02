import type { GlobalConfig } from 'payload'

import { isAdmin } from '@/access/roles'
import { createCacheInvalidationHook } from '@/hooks/revalidateCacheTags'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { MAX_GIVING_TRANSACTION_FEE_MINOR } from '@/lib/giving/fees'

export const GivingSettings: GlobalConfig = {
  slug: 'giving-settings',
  label: 'Giving Settings',
  admin: { group: 'Giving' },
  access: { read: isAdmin, update: isAdmin },
  hooks: { afterChange: [createCacheInvalidationHook(CACHE_TAGS.givingSettings)] },
  fields: [
    {
      name: 'transactionFeeMinor',
      label: 'BlinkPay transaction fee (cents)',
      type: 'number',
      required: true,
      defaultValue: 50,
      min: 0,
      max: MAX_GIVING_TRANSACTION_FEE_MINOR,
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
