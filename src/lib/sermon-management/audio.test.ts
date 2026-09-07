import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ffmpeg, renderSermonAudio } from './audio'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('finished sermon audio', () => {
  it.each([false, true])('preserves the cut and segment order with intro=%s', async (includeIntro) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'sermon-audio-test-'))
    directories.push(directory)
    const local = (name: string) => path.join(directory, name)
    for (const [name, frequency, duration] of [
      ['source', 440, 4], ['intro', 220, 1], ['outro', 880, 1],
    ] as const) {
      await ffmpeg(['-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${duration}`, local(`${name}.wav`)])
    }
    await renderSermonAudio({
      source: local('source.wav'),
      intro: includeIntro ? local('intro.wav') : undefined,
      outro: local('outro.wav'),
      output: local('finished.mp3'),
    }, 1, 3, 4)
    await ffmpeg(['-i', local('finished.mp3'), '-ac', '1', '-ar', '8000', '-f', 'f32le', local('decoded.pcm')])
    const pcm = await readFile(local('decoded.pcm'))
    expect(pcm.length / 4 / 8000).toBeCloseTo(includeIntro ? 4 : 3, 1)
    const frequencyAt = (second: number) => {
      let crossings = 0
      const start = Math.round(second * 8000)
      for (let i = start; i < start + 4000; i++) {
        if (pcm.readFloatLE(i * 4) <= 0 && pcm.readFloatLE((i + 1) * 4) > 0) crossings++
      }
      return crossings * 2
    }
    const expected = includeIntro ? [220, 440, 440, 880] : [440, 440, 880]
    expected.forEach((frequency, index) => expect(Math.abs(frequencyAt(index + 0.2) - frequency)).toBeLessThan(5))
  }, 20_000)
})
