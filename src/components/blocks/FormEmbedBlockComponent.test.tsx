import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  workflowPreview: vi.fn(),
  connectionPreview: vi.fn(),
}))

vi.mock('@/components/forms/RockForm', () => ({
  RockForm: ({
    initialSchema,
    fallbackAction,
  }: {
    initialSchema?: unknown
    fallbackAction?: { label: string; href: string }
  }) => (
    <p>
      {initialSchema ? 'Server-rendered workflow' : 'Client workflow fallback'}
      {fallbackAction && ` ${fallbackAction.label} ${fallbackAction.href}`}
    </p>
  ),
}))
vi.mock('@/components/forms/RockConnectionOpportunitySignup', () => ({
  RockConnectionOpportunitySignup: ({ initialSchema }: { initialSchema?: unknown }) => (
    <p>{initialSchema ? 'Server-rendered signup' : 'Client signup fallback'}</p>
  ),
}))
vi.mock('@/lib/rock-forms/config', () => ({
  getTurnstileSiteKey: () => 'site-key',
}))
vi.mock('@/lib/rock-forms/published', () => ({
  isRockFormPublished: async () => true,
}))
vi.mock('@/lib/rock-connection-signups/published', () => ({
  isRockConnectionSignupPublished: async () => true,
}))
vi.mock('@/lib/rock-form-previews', () => ({
  getRockFormPreview: mocks.workflowPreview,
  getRockConnectionSignupPreview: mocks.connectionPreview,
}))

import { FormEmbedBlockComponent } from './FormEmbedBlockComponent'

describe('FormEmbedBlockComponent protocol dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.workflowPreview.mockResolvedValue({ workflowName: 'Contact' })
    mocks.connectionPreview.mockResolvedValue({ opportunityName: 'Connect' })
  })

  afterEach(() => vi.restoreAllMocks())

  it('keeps legacy rows on the Workflow renderer inside the shared section shell', async () => {
    const component = await FormEmbedBlockComponent({
      heading: 'Get connected',
      rockWorkflowGuid: '00778880-81fe-4871-aa91-7c81783b8c4d',
    })
    const markup = renderToStaticMarkup(
      component,
    )
    expect(markup.match(/<section/g)).toHaveLength(1)
    expect(markup).toContain('Get connected')
    expect(markup).toContain('Server-rendered workflow')
    expect(markup).not.toContain('Server-rendered signup')
  })

  it('dispatches Connection Opportunity Signup without duplicating the section shell', async () => {
    const component = await FormEmbedBlockComponent({
      heading: 'Get connected',
      sourceType: 'connectionOpportunity',
      rockConnectionBlockGuid: '70f9eb00-5961-42bc-b1ea-dbcb8fce6369',
    })
    const markup = renderToStaticMarkup(
      component,
    )
    expect(markup.match(/<section/g)).toHaveLength(1)
    expect(markup).toContain('Get connected')
    expect(markup).toContain('Server-rendered signup')
    expect(markup).not.toContain('Server-rendered workflow')
  })

  it('falls back to client workflow startup when the server preview fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.workflowPreview.mockRejectedValueOnce(new Error('Rock unavailable'))

    const markup = renderToStaticMarkup(
      await FormEmbedBlockComponent({
        rockWorkflowGuid: '00778880-81fe-4871-aa91-7c81783b8c4d',
        fallbackContactLabel: 'Message our welcome team',
        fallbackContactHref: '/contact?topic=visit',
      }),
    )

    expect(markup).toContain('Client workflow fallback')
    expect(markup).toContain('Message our welcome team')
    expect(markup).toContain('/contact?topic=visit')
  })

  it('falls back to client connection startup when the server preview fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.connectionPreview.mockRejectedValueOnce(new Error('Rock unavailable'))

    const markup = renderToStaticMarkup(
      await FormEmbedBlockComponent({
        sourceType: 'connectionOpportunity',
        rockConnectionBlockGuid: '70f9eb00-5961-42bc-b1ea-dbcb8fce6369',
      }),
    )

    expect(markup).toContain('Client signup fallback')
  })
})
