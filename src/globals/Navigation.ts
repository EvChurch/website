import type { GlobalConfig } from 'payload'
import { revalidateTag } from 'next/cache'
import { isContentLead } from '@/access/roles'
import { CACHE_TAGS } from '@/lib/cache-tags'

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  access: {
    read: () => true,
    update: isContentLead,
  },
  hooks: {
    afterChange: [
      () => {
        revalidateTag(CACHE_TAGS.navigation, 'default')
      },
    ],
  },
  fields: [
    {
      name: 'mainNav',
      type: 'array',
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'href',
          type: 'text',
          required: true,
        },
        {
          name: 'children',
          type: 'array',
          fields: [
            {
              name: 'label',
              type: 'text',
            },
            {
              name: 'href',
              type: 'text',
            },
          ],
        },
      ],
    },
    {
      name: 'footerNav',
      type: 'array',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'links',
          type: 'array',
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
            },
            {
              name: 'href',
              type: 'text',
              required: true,
            },
            {
              name: 'meta',
              type: 'text',
            },
          ],
        },
      ],
    },
  ],
}
