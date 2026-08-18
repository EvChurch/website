import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FeatureGridBlockComponent } from './FeatureGridBlockComponent'

describe('FeatureGridBlockComponent', () => {
  it('stretches icon-top cards to equal row height without hiding content', () => {
    const markup = renderToStaticMarkup(
      <FeatureGridBlockComponent
        style="iconTop"
        layout="twoColumn"
        items={[
          { title: 'Short', description: 'One line.' },
          {
            title: 'Long',
            description: 'A longer description that must remain fully visible inside the card.',
          },
        ]}
      />,
    )

    expect(markup.match(/animate-on-scroll h-full/g)).toHaveLength(2)
    expect(markup.match(/flex h-full flex-col/g)).toHaveLength(2)
    expect(markup).toContain('One line.')
    expect(markup).toContain('A longer description that must remain fully visible inside the card.')
    expect(markup).not.toContain('line-clamp')
  })
})
