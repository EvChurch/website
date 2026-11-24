// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ChristmasPage from '@/app/(frontend)/christmas/page'

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
  await act(async () => root.render(<ChristmasPage />))

  for (const [label, id] of [['Central', 'central'], ['North', 'north'], ['Unichurch', 'unichurch'], ['Central', 'central']]) {
    // Alternate between the timeline and invitation controls.
    const controls = container.querySelectorAll('[role="group"]')
    const control = controls[id === 'north' ? 1 : 0]
    const pill = Array.from(control.querySelectorAll('button')).find((button) => button.textContent === label)!
    await act(async () => pill.click())
    expect(pill.getAttribute('aria-pressed')).toBe('true')
    for (const group of controls) {
      expect(group.querySelector('[aria-pressed="true"]')!.textContent).toBe(label)
    }
    for (const campus of ['central', 'north', 'unichurch']) {
      expect(container.querySelector(`#${campus}`)!.parentElement!.hidden).toBe(campus !== id)
    }
    expect(container.querySelector('#share img')!.getAttribute('src')).toBe(`/christmas/share/ev-christmas-2026-${id}.jpg`)
    await act(async () => container.querySelector<HTMLButtonElement>('figure button')!.click())
    expect(share.mock.lastCall![0].files[0].name).toBe(`ev-christmas-2026-${id}.jpg`)
  }
})

it('offers the selected image for download when native sharing is unavailable', async () => {
  vi.stubGlobal('navigator', {})
  await act(async () => root.render(<ChristmasPage />))
  const north = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'North')!
  await act(async () => north.click())
  await act(async () => container.querySelector<HTMLButtonElement>('figure button')!.click())
  expect(container.querySelector('a[download]')!.getAttribute('href')).toBe('/christmas/share/ev-christmas-2026-north.jpg')
  expect(container.textContent).not.toContain('Share Christmas')
})


it('switches the timeline and invitation to Central from the Unichurch Christmas Day note', async () => {
  vi.stubGlobal('navigator', {})
  await act(async () => root.render(<ChristmasPage />))
  const unichurch = container.querySelector<HTMLButtonElement>('[role="group"] button:last-child')!
  await act(async () => unichurch.click())
  await act(async () => container.querySelector<HTMLButtonElement>('#unichurch p button')!.click())
  expect(container.querySelector('#central')!.parentElement!.hidden).toBe(false)
  expect(container.querySelector('#unichurch')!.parentElement!.hidden).toBe(true)
  expect(container.querySelector('#share img')!.getAttribute('src')).toBe('/christmas/share/ev-christmas-2026-central.jpg')
})
