// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useListeningStore } from '@/lib/listening-store'
import {
  MediaPlayerProvider,
  type SermonMedia,
  useMediaPlayer,
} from './MediaPlayerProvider'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const memberVideo: SermonMedia = {
  id: 245,
  slug: 'connect-group-resource-245',
  title: 'Hebrews Study 4',
  access: 'members',
  audioUrl: '',
  videos: [{
    campusName: 'Video',
    campusSlug: 'resource-video',
    youtubeVideoId: 'dQw4w9WgXcQ',
  }],
}

function ResumeProbe({ media }: { media: SermonMedia }) {
  const player = useMediaPlayer()
  return (
    <>
      <button type="button" onClick={() => player.play(media, 'video', 'resource-video')}>
        Play
      </button>
      <output data-resume-time={player.videoResumeTimeRef.current} />
    </>
  )
}

describe('MediaPlayerProvider member video resume', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    useListeningStore.setState({ history: {} })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  async function play(media: SermonMedia) {
    await act(async () => root.render(
      <MediaPlayerProvider><ResumeProbe media={media} /></MediaPlayerProvider>,
    ))
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
    return Number(container.querySelector('output')?.getAttribute('data-resume-time'))
  }

  it('forwards legacy saved progress to a member-only video', async () => {
    useListeningStore.setState({
      history: {
        [memberVideo.slug]: {
          slug: memberVideo.slug,
          title: '',
          access: 'members',
          audioUrl: '',
          progress: 125,
          duration: 900,
          completed: false,
          lastPlayedAt: 1,
        },
      },
    })

    expect(await play(memberVideo)).toBe(125)
  })

  it('does not reuse legacy progress for public or audio-capable media', async () => {
    const publicMedia = { ...memberVideo, access: 'public' as const, audioUrl: '/sermon.mp3' }
    useListeningStore.setState({
      history: {
        [publicMedia.slug]: {
          slug: publicMedia.slug,
          title: '',
          access: 'public',
          audioUrl: '/sermon.mp3',
          progress: 125,
          duration: 900,
          completed: false,
          lastPlayedAt: 1,
        },
      },
    })

    expect(await play(publicMedia)).toBe(0)
  })
})
