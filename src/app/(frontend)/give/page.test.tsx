import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({ unstable_cache: mocks.unstableCache }))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

vi.mock('@/components/blocks/RenderBlocks', () => ({
  RenderBlocks: ({ blocks }: { blocks: Array<{ heading?: string }> }) => (
    <div>{blocks.map((block) => block.heading).join(',')}</div>
  ),
}))

import GivePage, { generateMetadata } from './page'

describe('Give page', () => {
  beforeEach(() => {
    mocks.find.mockResolvedValue({
      docs: [{
        title: 'Giving',
        slug: 'give',
        layout: [{ blockType: 'content', heading: 'Why we give' }],
        seo: {
          metaTitle: 'Giving | Ev Church Auckland',
          metaDescription: 'Learn why the Ev Church family gives.',
        },
      }],
    })
  })

  it('renders the published Payload page and metadata for the give slug', async () => {
    const markup = renderToStaticMarkup(await GivePage())

    expect(markup).toContain('Why we give')
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'pages',
      where: { slug: { equals: 'give' } },
    }))
    await expect(generateMetadata()).resolves.toEqual(expect.objectContaining({
      title: { absolute: 'Giving | Ev Church Auckland' },
      description: 'Learn why the Ev Church family gives.',
      alternates: { canonical: 'https://www.ev.church/give' },
    }))
  })
})
