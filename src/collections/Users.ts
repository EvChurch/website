import type { CollectionConfig } from 'payload'
import type { User } from '@/payload-types'

import { adminOnlyField, hasPayloadAdminRole, isAdmin } from '@/access/roles'
import { auth0PayloadStrategy } from '@/auth/auth0-payload-strategy'
import {
  protectLastAdminDelete,
  protectLastAdminUpdate,
} from '@/hooks/protectLastAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    disableLocalStrategy: true,
    useAPIKey: false,
    strategies: [auth0PayloadStrategy],
  },
  access: {
    create: () => false,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'roles'],
    hidden: ({ user }) => !hasPayloadAdminRole(user as User | null),
  },
  hooks: {
    beforeChange: [protectLastAdminUpdate],
    beforeDelete: [protectLastAdminDelete],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'auth0IdentityKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        hidden: true,
      },
      access: {
        update: () => false,
      },
    },
    {
      name: 'auth0Issuer',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      access: {
        update: () => false,
      },
    },
    {
      name: 'auth0Subject',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      access: {
        update: () => false,
      },
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Content Lead', value: 'content-lead' },
        { label: 'Editor', value: 'editor' },
      ],
      required: false,
      access: {
        update: adminOnlyField,
      },
    },
  ],
}
