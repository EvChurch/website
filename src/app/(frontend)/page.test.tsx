import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  renderBlocks: vi.fn(() => null),
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

vi.mock('@/components/blocks/RenderBlocks', () => ({
  RenderBlocks: mocks.renderBlocks,
}))

import HomePage from './page'

describe('HomePage upcoming events placement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the Payload layout without injecting events outside it', async () => {
    const blocks = [
      { id: 'hero', blockType: 'hero' },
      { id: 'sermon', blockType: 'latestSermon' },
      { id: 'events', blockType: 'upcomingEvents' },
      { id: 'cta', blockType: 'cta' },
    ]
    mocks.find.mockResolvedValue({ docs: [{ layout: blocks }] })

    renderToStaticMarkup(await HomePage())

    expect(mocks.renderBlocks).toHaveBeenCalledOnce()
    expect(mocks.renderBlocks).toHaveBeenCalledWith({ blocks }, undefined)
  })
})
