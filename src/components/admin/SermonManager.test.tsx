// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { SermonManager } from './SermonManager'
vi.mock('@payloadcms/ui', () => ({ useNav: () => ({ setNavOpen: closeNav }) }))
vi.mock('next/link', () => ({ default: 'a' }))
const closeNav = vi.fn()
let root: Root
let container: HTMLDivElement
const metadata = { title: 'The Confidence to Continue', publishedAt: '2026-09-06', audioSpeaker: 5, audioCampus: 3, passageReference: 'Hebrews 10:19-39', scriptures: [1], series: [1], topics: [] }
const production = { id: 4, status: 'ready', sourceName: 'service.mp3', metadata, start: 10, end: 90, source: 1, sourceDuration: 100, listeningCopy: { url: '/source.mp3' }, output: { url: '/finished.mp3' }, peaks: [0.2, 0.5] }
const dashboard = { configured: true, productions: [production], sermons: { docs: [], page: 1, totalPages: 1 }, folders: [], speakers: [{ id: 5, name: 'Ming Yong' }], campuses: [{ id: 3, name: 'Unichurch' }], series: [{ id: 1, title: 'Hebrews' }], scriptures: [{ id: 1, name: 'Hebrews' }], topics: [], topicReviews: [] }
async function setup(incomplete = false) {
  const row = { ...production, metadata: { ...metadata, ...(incomplete ? { audioSpeaker: undefined } : {}) } }
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => ({ ok: init?.method !== 'POST', json: async () => init?.method === 'POST' ? { error: 'Save failed' } : url.includes('?production=') ? { production: row } : dashboard })))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<SermonManager />))
  await click('service.mp3')
}
async function click(text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.trim() === text)
  expect(button).toBeTruthy()
  await act(async () => button!.click())
}
function stage() { return container.querySelector('.sermon-manager__stage:not([hidden])')! }
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('opens finished drafts at review, keeps publishing gated, and pauses audio when changing stages', async () => {
  await setup()
  expect(stage().textContent).toContain('Ready to publish?')
  expect(container.querySelector<HTMLButtonElement>('.sermon-manager__stage:not([hidden]) button.sermon-manager__primary')?.disabled).toBe(true)
  await click('1Trim audio')
  expect(stage().textContent).toContain('Trim the recording')
  await click('Continue to details →')
  expect(stage().textContent).toContain('Check the details')
  expect(container.querySelector('[aria-label="Add topics"]')).toBeNull()
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  expect(closeNav).toHaveBeenCalledWith(false)
})
it('opens incomplete ready drafts at details and stays there if saving fails', async () => {
  await setup(true)
  expect(stage().textContent).toContain('Check the details')
  const select = container.querySelector<HTMLSelectElement>('.sermon-manager__grid select')!
  await act(async () => { select.value = '5'; select.dispatchEvent(new Event('change', { bubbles: true })) })
  await click('Continue to review →')
  expect(stage().textContent).toContain('Check the details')
  expect(container.textContent).toContain('Save failed')
})
