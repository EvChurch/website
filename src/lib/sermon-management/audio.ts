import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
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

/** Measure one peak per second without decoding an entire recording into browser memory. */
export async function prepareListeningCopy(
  source: string,
  preview: string,
  samples: string,
) {
  await ffmpeg([
    '-protocol_whitelist',
    'file,pipe',
    '-format_whitelist',
    'aac,aiff,flac,mp3,mov,ogg,wav',
    '-i',
    source,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '44100',
    '-b:a',
    '96k',
    preview,
  ])
  const { stdout } = await ffmpeg([
    '-protocol_whitelist',
    'file,pipe',
    '-format_whitelist',
    'aac,aiff,flac,mp3,mov,ogg,wav',
    '-i',
    source,
    '-vn',
    '-af',
    `aresample=8000,aformat=channel_layouts=mono,asetnsamples=n=8000:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=${samples}`,
    '-progress',
    'pipe:1',
    '-f',
    'null',
    '-',
  ])
  const times = [...stdout.matchAll(/out_time_us=(\d+)/g)]
  const duration = Number(times.at(-1)?.[1]) / 1_000_000
  if (!duration || duration > 6 * 60 * 60)
    throw new Error('Choose a recording with audio, up to six hours long.')
  const measurements = await readFile(samples, 'utf8')
  const levels = [
    ...measurements.matchAll(/lavfi\.astats\.Overall\.Peak_level=([^\r\n]+)/g),
  ].map((match) => {
    const level = Number(match[1])
    return Number.isFinite(level) ? Math.pow(10, level / 20) : 0
  })
  const step = Math.max(1, Math.ceil(levels.length / 1200))
  const peaks: number[] = []
  for (let i = 0; i < levels.length; i += step)
    peaks.push(Math.max(...levels.slice(i, i + step)))
  const max = Math.max(...peaks, 0.001)
  return {
    duration,
    peaks: peaks.map((peak) => Math.round((peak / max) * 1000) / 1000),
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
  const inputs = [paths.source, paths.outro, ...(paths.intro ? [paths.intro] : [])]
  const filters = [
    `[0:a:0]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,${format}[sermon]`,
    `[1:a:0]asetpts=PTS-STARTPTS,${format}[outro]`,
    ...(paths.intro ? [`[2:a:0]asetpts=PTS-STARTPTS,${format}[intro]`] : []),
    `${paths.intro ? '[intro]' : ''}[sermon][outro]concat=n=${inputs.length}:v=0:a=1[out]`,
  ]
  await ffmpeg([
    ...inputs.flatMap((input) => [
      '-protocol_whitelist',
      'file,pipe',
      '-format_whitelist',
      'aac,aiff,flac,mp3,mov,ogg,wav',
      '-i',
      input,
    ]),
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[out]',
    '-map_metadata',
    '-1',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '192k',
    paths.output,
  ])
}
