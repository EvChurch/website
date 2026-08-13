import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MediaImage } from './MediaImage'

const media = {
  url: '/media/original.jpg',
  alt: 'Youth leaders',
  width: 3840,
  height: 2560,
  sizes: {
    thumbnail: { url: '/media/original-400x400.jpg', width: 400, height: 400 },
    medium: { url: '/media/original-900x600.jpg', width: 900, height: 600 },
    large: { url: '/media/original-1200x800.jpg', width: 1200, height: 800 },
    hero: { url: '/media/original-1920x1080.jpg', width: 1920, height: 1080 },
  },
}

describe('MediaImage', () => {
  it('renders the requested Payload derivative without exposing the original URL', () => {
    const markup = renderToStaticMarkup(
      <MediaImage media={media} mediaSize="medium" width={450} height={300} alt="" />,
    )

    expect(markup).toContain('original-900x600.jpg')
    expect(markup).not.toContain('original.jpg')
  })

  it('does not fall back to the original when the requested derivative is missing', () => {
    const markup = renderToStaticMarkup(
      <MediaImage
        media={{ ...media, sizes: {} }}
        mediaSize="large"
        width={600}
        height={400}
        alt=""
      />,
    )

    expect(markup).toBe('')
  })

  it('uses the closest generated derivative when an older upload lacks the requested size', () => {
    const markup = renderToStaticMarkup(
      <MediaImage
        media={{ ...media, sizes: { thumbnail: media.sizes.thumbnail } }}
        mediaSize="hero"
        width={600}
        height={400}
        alt=""
      />,
    )

    expect(markup).toContain('original-400x400.jpg')
    expect(markup).not.toContain('original.jpg')
  })

  it('continues to render non-Payload string sources', () => {
    const markup = renderToStaticMarkup(
      <MediaImage media="/static/logo.png" mediaSize="thumbnail" width={100} height={100} alt="" />,
    )

    expect(markup).toContain('logo.png')
  })
})
