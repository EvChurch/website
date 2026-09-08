// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { SermonTranscript } from './SermonTranscript'
const play = vi.hoisted(() => vi.fn())
vi.mock('@/components/media/MediaPlayerProvider', () => ({ useMediaPlayer: () => ({ play }) }))
it('seeks the audio player to the published timestamp', async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })
  const container = document.createElement('div')
  const root = createRoot(container)
  const sermon = { id: 1, title: 'Sermon', slug: 'sermon', audioUrl: '/sermon.mp3' }
  await act(async () => root.render(<SermonTranscript sermon={sermon} segments={[{ text: 'The sermon', start: 65.2, end: 70 }]} />))
  expect(container.textContent).toContain('1:05')
  await act(async () => container.querySelector('button')!.click())
  expect(play).toHaveBeenCalledWith(sermon, 'audio', undefined, 65.2)
  await act(async () => root.unmount())
})
