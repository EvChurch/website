import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createReadStream } from 'node:fs'
import ffmpegPath from 'ffmpeg-static'

const exec = promisify(execFile)
export async function ffmpeg(args: string[]) {
  if (!ffmpegPath)
    throw new Error('Audio processing is unavailable on this server.')
  return exec(
    process.env.SERMON_FFMPEG_PATH || ffmpegPath,
    ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...args],
    { timeout: 20 * 60_000, maxBuffer: 1024 * 1024 },
  )
}

export function validateCut(start: number, end: number, duration: number) {
  if (
    ![start, end, duration].every(Number.isFinite) ||
    start < 0 ||
    end <= start ||
    end > duration + 0.01
  ) {
    throw new Error('Choose a start before the end, within the recording.')
  }
}

/** Measure before applying gain, preserving dynamics when the peak ceiling allows it. */
async function normalizedMP3(
  inputs: string[],
  graph: string,
  output: string,
  target: number,
  bitrate: string,
) {
  const settings = `I=${target}:TP=-1.5:LRA=11`
  const { stderr } = await ffmpeg([
    ...inputs,
    '-loglevel',
    'info',
    '-nostats',
    '-filter_complex',
    `${graph};[mix]loudnorm=${settings}:print_format=json[normalized]`,
    '-map',
    '[normalized]',
    '-f',
    'null',
    '-',
  ])
  const json = stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0]
  if (!json) throw new Error('Unable to measure audio loudness.')
  const measurements: Record<string, unknown> = JSON.parse(json)
  const keys = [
    'input_i',
    'input_tp',
    'input_lra',
    'input_thresh',
    'target_offset',
  ] as const
  const values = keys.map((key) => Number(measurements[key]))
  // Silence (and very short clips) can have no measurable integrated loudness.
  // Never turn -inf measurements into invalid FFmpeg filter parameters.
  const filter = values.every(Number.isFinite)
    ? `loudnorm=${settings}:measured_I=${values[0]}:measured_TP=${values[1]}:measured_LRA=${values[2]}:measured_thresh=${values[3]}:offset=${values[4]}:linear=true`
    : 'anull'
  await ffmpeg([
    ...inputs,
    '-filter_complex',
    `${graph};[mix]${filter}[normalized]`,
    '-map',
    '[normalized]',
    '-map_metadata',
    '-1',
    '-ar',
    '44100',
    '-c:a',
    'libmp3lame',
    '-b:a',
    bitrate,
    output,
  ])
}

/** Measure one peak per second without decoding an entire recording into browser memory. */
export async function prepareListeningCopy(
  source: string,
  preview: string,
  samples: string,
) {
  await normalizedMP3(
    [
      '-protocol_whitelist',
      'file,pipe',
      '-format_whitelist',
      'aac,aiff,flac,mp3,mov,ogg,wav',
      '-i',
      source,
    ],
    '[0:a:0]aformat=channel_layouts=mono[mix]',
    preview,
    -19,
    '96k',
  )
  return prepareWaveform(source, samples)
}

/** Keep 10 ms peaks; the editor aggregates only the visible interval when zooming. */
export async function prepareWaveform(source: string, samples: string) {
  await ffmpeg([
    '-protocol_whitelist', 'file,pipe',
    '-format_whitelist', 'aac,aiff,flac,mp3,mov,ogg,wav',
    '-i', source, '-vn', '-ac', '1', '-ar', '8000',
    '-f', 's16le', samples,
  ])
  const peaks: number[] = []
  let count = 0
  let peak = 0
  let max = 1
  // File chunks and the final PCM length are multiples of the two-byte sample size.
  for await (const chunk of createReadStream(samples, { highWaterMark: 65536 })) {
    for (let offset = 0; offset < chunk.length; offset += 2) {
      peak = Math.max(peak, Math.abs(chunk.readInt16LE(offset)))
      count++
      if (count % 80 === 0) {
        peaks.push(peak)
        max = Math.max(max, peak)
        peak = 0
      }
    }
    if (count > 8000 * 6 * 60 * 60)
      throw new Error('Choose a recording with audio, up to six hours long.')
  }
  if (!count) throw new Error('Choose a recording with audio.')
  if (count % 80) {
    peaks.push(peak)
    max = Math.max(max, peak)
  }
  return {
    duration: count / 8000,
    peaks: peaks.map(value => Math.round(value / max * 1000) / 1000),
  }
}

export async function renderSermonAudio(
  paths: { source: string; intro?: string; outro: string; output: string },
  start: number,
  end: number,
  duration: number,
) {
  validateCut(start, end, duration)
  const format =
    'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo'
  const inputs = [
    paths.source,
    paths.outro,
    ...(paths.intro ? [paths.intro] : []),
  ]
  const filters = [
    `[0:a:0]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,${format}[sermon]`,
    `[1:a:0]asetpts=PTS-STARTPTS,${format}[outro]`,
    ...(paths.intro ? [`[2:a:0]asetpts=PTS-STARTPTS,${format}[intro]`] : []),
    `${paths.intro ? '[intro]' : ''}[sermon][outro]concat=n=${inputs.length}:v=0:a=1[mix]`,
  ]
  await normalizedMP3(
    inputs.flatMap((input) => [
      '-protocol_whitelist',
      'file,pipe',
      '-format_whitelist',
      'aac,aiff,flac,mp3,mov,ogg,wav',
      '-i',
      input,
    ]),
    filters.join(';'),
    paths.output,
    -16,
    '192k',
  )
}
