import { revalidateTag } from 'next/cache'
import type { Access, CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig, FieldAccess } from 'payload'
import { hasExactPayloadAdminRole, isAdmin } from '@/access/roles'
import { CACHE_TAGS } from '@/lib/cache-tags'

const publicActiveFunds: Access = ({ req: { user } }) => hasExactPayloadAdminRole(user as never) || { active: { equals: true } }
const adminField: FieldAccess = ({ req: { user } }) => hasExactPayloadAdminRole(user as never)
const protectReferencedFund: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const gifts = await req.payload.count({ collection: 'giving-gifts', where: { fund: { equals: id } } })
  if (gifts.totalDocs) throw new Error('Referenced giving funds cannot be deleted')
}

export const swapDefaultGivingFund: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (data.isDefault === true && data.active !== false) {
    await req.payload.update({
      collection: 'giving-funds',
      where: {
        and: [
          { isDefault: { equals: true } },
          ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
        ],
      },
      data: { isDefault: false },
      context: { skipGivingDefaultSwap: true },
      overrideAccess: true,
      req,
    })
  }
  return data
}

export const protectSoleDefaultGivingFund: CollectionBeforeChangeHook = ({ data, originalDoc, context }) => {
  if (context.skipGivingDefaultSwap) return data
  if (originalDoc?.isDefault && originalDoc.active && (data.isDefault === false || data.active === false)) {
    throw new Error('Choose another active default fund before deactivating or unsetting the current default')
  }
  return data
}

export const GivingFunds: CollectionConfig = {
  slug: 'giving-funds', admin: { group: 'Giving', useAsTitle: 'name', defaultColumns: ['name', 'code', 'active', 'isDefault', 'sortOrder'], description: 'Exact admins may manage public funds. There must always be one active default fund.' },
  access: { read: publicActiveFunds, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: { afterChange: [() => revalidateTag(CACHE_TAGS.givingFunds, 'default')], afterDelete: [() => revalidateTag(CACHE_TAGS.givingFunds, 'default')], beforeChange: [protectSoleDefaultGivingFund, swapDefaultGivingFund], beforeDelete: [protectReferencedFund] },
  fields: [
    { name: 'name', type: 'text', required: true }, { name: 'code', type: 'text', required: true, unique: true, index: true },
    { name: 'accountingKey', type: 'text', required: true, access: { read: adminField }, admin: { readOnly: false } },
    { name: 'description', type: 'textarea' }, { name: 'active', type: 'checkbox', required: true, defaultValue: true, index: true },
    { name: 'isDefault', type: 'checkbox', required: true, defaultValue: false, index: true }, { name: 'sortOrder', type: 'number', required: true, defaultValue: 0, index: true },
  ],
}
