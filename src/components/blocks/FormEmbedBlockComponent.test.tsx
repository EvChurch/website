import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FormEmbedBlockComponent } from './FormEmbedBlockComponent'

describe('FormEmbedBlockComponent protocol dispatch', () => {
  it('keeps legacy rows on the Workflow renderer inside the shared section shell', () => {
    const markup = renderToStaticMarkup(
      <FormEmbedBlockComponent
        heading="Get connected"
        rockWorkflowGuid="00778880-81fe-4871-aa91-7c81783b8c4d"
      />,
    )
    expect(markup.match(/<section/g)).toHaveLength(1)
    expect(markup).toContain('Get connected')
    expect(markup).toContain('Loading form…')
    expect(markup).not.toContain('Loading signup…')
  })

  it('dispatches Connection Opportunity Signup without duplicating the section shell', () => {
    const markup = renderToStaticMarkup(
      <FormEmbedBlockComponent
        heading="Get connected"
        sourceType="connectionOpportunity"
        rockConnectionBlockGuid="495cda8e-60fe-4f77-a452-932b460fb44c"
      />,
    )
    expect(markup.match(/<section/g)).toHaveLength(1)
    expect(markup).toContain('Get connected')
    expect(markup).toContain('Loading signup…')
    expect(markup).not.toContain('Loading form…')
    expect(markup).toContain('max-w-3xl')
    expect(markup).not.toContain('rounded-xl border')
  })
})
