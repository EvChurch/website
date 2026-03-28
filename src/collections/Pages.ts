import type { CollectionConfig } from 'payload'
import { isContentLead, isEditor, publishedOnly } from '@/access/roles'
import { HeroBlock } from '@/blocks/HeroBlock'
import { ContentBlock } from '@/blocks/ContentBlock'
import { CTABlock } from '@/blocks/CTABlock'
import { CardGridBlock } from '@/blocks/CardGridBlock'
import { AccordionBlock } from '@/blocks/AccordionBlock'
import { ImageGalleryBlock } from '@/blocks/ImageGalleryBlock'
import { VideoBlock } from '@/blocks/VideoBlock'
import { FeatureGridBlock } from '@/blocks/FeatureGridBlock'
import { TimelineBlock } from '@/blocks/TimelineBlock'
import { StatsGridBlock } from '@/blocks/StatsGridBlock'
import { BlockquoteBlock } from '@/blocks/BlockquoteBlock'
import { FormEmbedBlock } from '@/blocks/FormEmbedBlock'
import { ManualCardGridBlock } from '@/blocks/ManualCardGridBlock'
import { PhotoStripBlock } from '@/blocks/PhotoStripBlock'
import { PageHeaderBlock } from '@/blocks/PageHeaderBlock'
import { GospelStepperBlock } from '@/blocks/GospelStepperBlock'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
  },
  versions: {
    drafts: {
      autosave: true,
    },
  },
  access: {
    read: publishedOnly,
    create: isContentLead,
    update: isEditor,
    delete: isContentLead,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL path for this page (e.g. "about", "visit"). Use "home" for the homepage.',
      },
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [
        HeroBlock,
        ContentBlock,
        CTABlock,
        CardGridBlock,
        AccordionBlock,
        ImageGalleryBlock,
        VideoBlock,
        FeatureGridBlock,
        TimelineBlock,
        StatsGridBlock,
        BlockquoteBlock,
        FormEmbedBlock,
        ManualCardGridBlock,
        PhotoStripBlock,
        PageHeaderBlock,
        GospelStepperBlock,
      ],
    },
    {
      name: 'template',
      type: 'select',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Ministry', value: 'ministry' },
        { label: 'Seasonal Event', value: 'seasonal-event' },
        { label: 'Simple Content', value: 'simple-content' },
      ],
      defaultValue: 'standard',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          admin: {
            description: 'Override the page title for search engines',
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          admin: {
            description: 'Description shown in search results (max 160 chars)',
          },
        },
        {
          name: 'ogImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Image shown when shared on social media',
          },
        },
      ],
    },
  ],
}
