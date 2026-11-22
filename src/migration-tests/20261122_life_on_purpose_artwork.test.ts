import { describe, expect, it, vi } from 'vitest'
import { up } from '../migrations/20261122_010000_life_on_purpose_artwork'

function setup(banner = 'life-on-purpose-banner.jpg', background = 'life-on-purpose-background.png', reuse = false) {
  const series = { id: 84, bannerImage: { filename: banner }, backgroundImage: { filename: background } }
  const find = vi.fn().mockImplementation(async ({ collection }: { collection: string }) => ({
    docs: collection === 'sermon-series' ? [series] : reuse ? [{ id: 500 }] : [],
  }))
  const create = vi.fn().mockResolvedValue({ id: 501 })
  const update = vi.fn().mockResolvedValue({})
  return { find, create, update, args: { payload: { find, create, update }, req: {} } as never }
}

describe('Life on Purpose artwork migration', () => {
  it('uploads and replaces only the known original artwork', async () => {
    const mock = setup()
    await up(mock.args)
    expect(mock.create).toHaveBeenCalledTimes(2)
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({
      id: 84, data: { bannerImage: 501, backgroundImage: 501 },
      context: { skipCacheInvalidation: true },
    }))
  })

  it('reuses media left by an interrupted migration', async () => {
    const mock = setup(undefined, undefined, true)
    await up(mock.args)
    expect(mock.create).not.toHaveBeenCalled()
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ data: { bannerImage: 500, backgroundImage: 500 } }))
  })

  it('preserves editorial replacements and skips completed migrations', async () => {
    for (const filename of ['editor-art.jpg', 'life-on-purpose-banner-2026.jpg']) {
      const mock = setup(filename, 'life-on-purpose-background-2026.jpg')
      await up(mock.args)
      expect(mock.create).not.toHaveBeenCalled()
      expect(mock.update).not.toHaveBeenCalled()
    }
  })

  it('does nothing when the series is absent', async () => {
    const mock = setup()
    mock.find.mockResolvedValue({ docs: [] })
    await up(mock.args)
    expect(mock.create).not.toHaveBeenCalled()
    expect(mock.update).not.toHaveBeenCalled()
  })
})
