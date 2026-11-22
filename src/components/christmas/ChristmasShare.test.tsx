// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChristmasShare } from './ChristmasShare'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('Christmas sharing', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
  async function clickShare() {
    await act(async () => root.render(<ChristmasShare />))
    await act(async () => container.querySelector('button')!.click())
  }
  it('opens the native chooser with the canonical Christmas link', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    await clickShare()
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://www.ev.church/christmas' }))
    expect(container.querySelector('nav')).toBeNull()
  })
  it('offers social links when native sharing is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    await clickShare()
    expect(container.querySelector('nav')).not.toBeNull()
    expect(container.querySelector('a')!.href).toBe('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fwww.ev.church%2Fchristmas')
  })
  it('leaves cancellation quiet but exposes alternatives for failures', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
    vi.stubGlobal('navigator', { share })
    await clickShare()
    expect(container.querySelector('nav')).toBeNull()
    expect(container.querySelector('[role="status"]')!.textContent).toBe('')
    share.mockRejectedValue(new Error('Not allowed'))
    await act(async () => container.querySelector('button')!.click())
    expect(container.querySelector('nav')).not.toBeNull()
  })
  it('shares a preloaded image without awaiting a fetch in the click handler', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image'], { type: 'image/jpeg' }) }))
    vi.stubGlobal('IntersectionObserver', class {
      constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
      observe() { this.callback([{ isIntersecting: true }]) }
      disconnect() {}
    })
    await act(async () => root.render(<ChristmasShare image="/christmas/share/invitation.jpg" />))
    await act(async () => container.querySelector('button')!.click())
    expect(share.mock.calls[0][0].files[0]).toBeInstanceOf(File)
    expect(share.mock.calls[0][0].files[0].name).toBe('invitation.jpg')
    expect(share.mock.calls[0][0].text).toContain('https://www.ev.church/christmas')
  })
})
