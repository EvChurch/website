// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeaderResourceShareButton } from './LeaderResourceShareButton'

describe('LeaderResourceShareButton', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const writeText = vi.fn()

  beforeEach(() => {
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ path: '/shared/leader-resources/stable' }) }))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); writeText.mockReset() })

  it('copies the stable absolute URL and acknowledges success', async () => {
    await act(async () => root.render(<LeaderResourceShareButton rockId={245} />))
    await act(async () => container.querySelector('button')?.click())
    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/shared/leader-resources/stable')
    expect(container.textContent).toContain('Link copied')
  })

  it('shows the URL for manual copying when clipboard access fails', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    await act(async () => root.render(<LeaderResourceShareButton rockId={245} />))
    await act(async () => container.querySelector('button')?.click())
    expect(container.textContent).not.toContain('Link copied')
    expect(container.querySelector('input')?.value).toContain('/shared/leader-resources/stable')
  })

  it('shows a retryable error without using the clipboard when creation fails', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)
    await act(async () => root.render(<LeaderResourceShareButton rockId={245} />))
    await act(async () => container.querySelector('button')?.click())
    expect(writeText).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Please try again')
  })
})
