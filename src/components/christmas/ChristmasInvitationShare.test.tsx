// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ChristmasInvitationShare } from './ChristmasInvitationShare'

vi.mock('next/image', () => ({ default: (props: React.ComponentProps<'img'>) => <img {...props} /> }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

it('previews and shares the selected campus invitation after switching campuses', async () => {
  const share = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { share, canShare: () => true })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image'], { type: 'image/jpeg' }) }))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
    observe() { this.callback([{ isIntersecting: true }]) }
    disconnect() {}
  })
  await act(async () => root.render(<ChristmasInvitationShare />))

  for (const [label, id] of [['Central', 'central'], ['North', 'north'], ['Unichurch', 'unichurch'], ['Central', 'central']]) {
    const pill = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === label)!
    await act(async () => pill.click())
    expect(pill.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('img')!.getAttribute('src')).toBe(`/christmas/share/ev-christmas-2026-${id}.jpg`)
    await act(async () => container.querySelector<HTMLButtonElement>('figure button')!.click())
    expect(share.mock.lastCall![0].files[0].name).toBe(`ev-christmas-2026-${id}.jpg`)
  }
})

it('offers the selected image for download when native sharing is unavailable', async () => {
  vi.stubGlobal('navigator', {})
  await act(async () => root.render(<ChristmasInvitationShare />))
  const north = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'North')!
  await act(async () => north.click())
  await act(async () => container.querySelector<HTMLButtonElement>('figure button')!.click())
  expect(container.querySelector('a[download]')!.getAttribute('href')).toBe('/christmas/share/ev-christmas-2026-north.jpg')
  expect(container.textContent).not.toContain('Share Christmas')
})
