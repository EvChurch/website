import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PhotoStripBlockComponent } from './PhotoStripBlockComponent'

describe('PhotoStripBlockComponent', () => {
  it('serves generated medium derivatives instead of original uploads', () => {
    const original = '/api/media/file/youthleaders-junior1.jpg'
    const derivative = '/api/media/file/youthleaders-junior1-900x1350.webp'
    const markup = renderToStaticMarkup(
      <PhotoStripBlockComponent
        images={[
          {
            image: {
              url: original,
              alt: 'Youth leaders',
              sizes: { mediumWebp: { url: derivative, width: 900, height: 1350 } },
            },
          },
        ]}
      />,
    )

    expect(markup).toContain('youthleaders-junior1-900x1350.webp')
    expect(markup).not.toContain(encodeURIComponent(original))
    expect(markup).not.toContain('youthleaders-junior1.jpg')
  })
})
