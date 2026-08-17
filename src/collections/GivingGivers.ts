import type { CollectionConfig } from 'payload'
import { denyExternalMutation, isAdmin } from '@/access/roles'
import { givingAdmin, readOnlyGivingFields } from './givingAdmin'
export const GivingGivers: CollectionConfig = { slug: 'giving-givers', admin: givingAdmin('bankReference',['synthetic','bankReference','rockPersonAliasId','name','email'],'Trace a giver by EV reference, Rock person alias, name or email.'), access: { read: isAdmin, create: denyExternalMutation, update: denyExternalMutation, delete: denyExternalMutation }, fields: readOnlyGivingFields([
  { name: 'contextKey', type: 'text', required: true, index: true, admin: { readOnly: true } }, { name: 'environment', type: 'select', required: true, options: ['sandbox','production'], index: true, admin: { readOnly: true } }, { name: 'synthetic', type: 'checkbox', required: true, index: true, admin: { readOnly: true } },
  { name: 'rockPersonAliasId', type: 'number', required: true, index: true, admin: { readOnly: true } }, { name: 'bankReference', type: 'text', required: true, index: true, admin: { readOnly: true } }, { name: 'name', type: 'text', required: true, admin: { readOnly: true } }, { name: 'email', type: 'email', required: true, index: true, admin: { readOnly: true } },
]) }
