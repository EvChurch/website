// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { MediaPlayerProvider, useMediaPlayer } from './MediaPlayerProvider'
let player: ReturnType<typeof useMediaPlayer>
function Consumer() { player = useMediaPlayer(); return null }
afterEach(() => vi.restoreAllMocks())
it('keeps the latest timestamp while audio loads and reloads replacement audio', async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })
  const audio = document.createElement('audio')
  vi.stubGlobal('Audio', function () { return audio })
  vi.spyOn(audio, 'play').mockResolvedValue(undefined)
  vi.spyOn(audio, 'pause').mockImplementation(() => {})
  const container = document.createElement('div')
  const root = createRoot(container)
  await act(async () => root.render(<MediaPlayerProvider><Consumer /></MediaPlayerProvider>))
  const sermon = { id: 1, title: 'Sermon', slug: 'test', audioUrl: '/first.mp3' }
  await act(async () => player.play(sermon, 'audio', undefined, 20))
  await act(async () => player.play(sermon, 'audio', undefined, 65))
  await act(async () => audio.dispatchEvent(new Event('canplay')))
  expect(audio.currentTime).toBe(65)
  await act(async () => player.play({ ...sermon, audioUrl: '/replacement.mp3' }, 'audio', undefined, 10))
  expect(audio.src).toContain('replacement.mp3')
  await act(async () => audio.dispatchEvent(new Event('canplay')))
  expect(audio.currentTime).toBe(10)
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})
