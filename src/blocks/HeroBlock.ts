import type { Block } from 'payload'

export const HeroBlock: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'eyebrow',
      type: 'text',
      admin: { description: 'Small uppercase text above heading (e.g. "Auckland, New Zealand")' },
    },
    {
      name: 'heading',
      type: 'text',
      required: true,
    },
    {
      name: 'highlightedText',
      type: 'text',
      admin: { description: 'Word(s) in the heading to render in italic accent color (e.g. "belong")' },
    },
    {
      name: 'subtitle',
      type: 'textarea',
    },
    {
      name: 'supportingText',
      type: 'textarea',
      admin: { description: 'Smaller muted text below subtitle (used for SEO)' },
    },
    {
      name: 'semanticH1',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'When enabled, the eyebrow text becomes the semantic H1 (for SEO) and the main heading becomes H2. Use on pages where the eyebrow contains the primary keyword.',
      },
    },
    {
      name: 'keyColor',
      type: 'text',
      admin: { description: 'Hex colour override for eyebrow, italic accent, and overlay fade (e.g. #0096C3)' },
    },
    {
      name: 'overlayStyle',
      type: 'select',
      defaultValue: 'default',
      options: [
        { label: 'Default (bottom gradient)', value: 'default' },
        { label: 'Cinematic (layered)', value: 'cinematic' },
        { label: 'Left to right', value: 'leftToRight' },
      ],
    },
    {
      name: 'minHeight',
      type: 'select',
      defaultValue: '70vh',
      options: [
        { label: 'Short (50vh)', value: '50vh' },
        { label: 'Medium (70vh)', value: '70vh' },
        { label: 'Tall (80vh)', value: '80vh' },
        { label: 'Full (85vh)', value: '85vh' },
      ],
    },
    {
      name: 'buttons',
      type: 'array',
      maxRows: 2,
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
          name: 'variant',
          type: 'select',
          options: [
            { label: 'Primary', value: 'primary' },
            { label: 'Secondary', value: 'secondary' },
            { label: 'Text', value: 'text' },
          ],
        },
      ],
    },
  ],
}
