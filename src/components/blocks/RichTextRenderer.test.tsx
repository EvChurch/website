import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import RichText from './RichTextRenderer'

describe('RichTextRenderer uploads', () => {
  it('renders populated media uploads embedded in Payload rich text', () => {
    const markup = renderToStaticMarkup(
      <RichText data={{
        root: {
          children: [{
            type: 'upload',
            relationTo: 'media',
            value: {
              url: 'https://cdn.example.com/article.jpg',
              alt: 'People gathering',
              width: 1200,
              height: 800,
              mimeType: 'image/jpeg',
            },
          }],
        },
      }} />,
    )

    expect(markup).toContain('src="https://cdn.example.com/article.jpg"')
    expect(markup).toContain('alt="People gathering"')
  })

  it('resolves populated internal blog links to their public route', () => {
    const markup = renderToStaticMarkup(
      <RichText data={{
        root: {
          children: [{
            type: 'link',
            fields: {
              linkType: 'internal',
              doc: {
                relationTo: 'blog-posts',
                value: { slug: 'real-story' },
              },
            },
            children: [{ type: 'text', text: 'Read the story' }],
          }],
        },
      }} />,
    )

    expect(markup).toContain('href="/blog/real-story"')
  })
})
