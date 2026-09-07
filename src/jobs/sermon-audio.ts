import { withProduction } from '@/lib/sermon-management/workflow'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { TaskConfig } from 'payload'
import { downloadRecording, relationID } from '@/lib/sermon-management/drive'
import {
  ffmpeg,
  prepareListeningCopy,
  renderSermonAudio,
} from '@/lib/sermon-management/audio'
import { copyWorkFile } from '@/lib/sermon-management/storage'

export const sermonAudioTask: TaskConfig<'prepareSermonAudio'> = {
  slug: 'prepareSermonAudio',
  retries: 2,
  inputSchema: [
    { name: 'productionId', type: 'number', required: true },
    { name: 'token', type: 'text', required: true },
  ],
  outputSchema: [],
  handler: async ({ input, req }) => {
    const payload = req.payload
    const production = await payload.findByID({
      collection: 'sermon-productions',
      id: input.productionId,
      depth: 0,
    })
    if (
      production.jobToken !== input.token ||
      !['importing', 'rendering'].includes(production.status)
    )
      return { output: {} }
    const directory = await mkdtemp(path.join(tmpdir(), 'sermon-'))
    const local = (name: string) => path.join(directory, name)
    const finish = (
      data: Partial<import('@/payload-types').SermonProduction>,
    ) =>
      withProduction(
        payload,
        production.id,
        undefined,
        async (current, request) => {
          if (
            current.jobToken !== input.token ||
            !['importing', 'rendering'].includes(current.status)
          )
            return
          await payload.update({
            collection: 'sermon-productions',
            id: production.id,
            req: request,
            data,
          })
        },
      )
    try {
      const settings = await payload.findGlobal({
        slug: 'sermon-settings',
        depth: 0,
      })
      if (production.status === 'importing') {
        const sourceFile = await downloadRecording(
          settings,
          production.driveFileId!,
          production.driveModifiedTime!,
          local('source'),
        )
        const { duration, peaks } = await prepareListeningCopy(
          local('source'),
          local('preview.mp3'),
          local('samples.pcm'),
        )
        const sourceData = await readFile(local('source'))
        const source = await payload.create({
          collection: 'sermon-work-files',
          data: {},
          file: {
            data: sourceData,
            size: sourceData.length,
            mimetype: sourceFile.mimeType,
            name: `${input.token}-source${path.extname(sourceFile.name).replace(/[^.a-zA-Z0-9]/g, '') || '.audio'}`,
          },
        })
        const preview = await payload.create({
          collection: 'sermon-work-files',
          data: {},
          filePath: local('preview.mp3'),
        })
        await finish({
          source: source.id,
          listeningCopy: preview.id,
          sourceDuration: duration,
          peaks,
          start: 0,
          end: duration,
          status: 'editable',
          error: null,
        })
      } else {
        const sourceID = relationID(production.source)
        const introID = relationID(production.intro)
        const outroID = relationID(production.outro)
        if (!sourceID || !outroID)
          throw new Error(
            'Source or outro is missing. Ask an administrator to check Sermon Settings.',
          )
        await Promise.all([
          copyWorkFile(payload, sourceID, local('source')),
          ...(introID ? [copyWorkFile(payload, introID, local('intro'))] : []),
          copyWorkFile(payload, outroID, local('outro')),
        ])
        await renderSermonAudio(
          {
            source: local('source'),
            intro: introID ? local('intro') : undefined,
            outro: local('outro'),
            output: local('finished.mp3'),
          },
          production.start!,
          production.end!,
          production.sourceDuration!,
        )
        await ffmpeg([
          '-i',
          local('finished.mp3'),
          '-ac',
          '1',
          '-ar',
          '10',
          '-f',
          'f32le',
          local('duration.pcm'),
        ])
        const duration = (await readFile(local('duration.pcm'))).length / 40
        const output = await payload.create({
          collection: 'sermon-work-files',
          data: {},
          filePath: local('finished.mp3'),
        })
        await finish({
          output: output.id,
          outputDuration: duration,
          status: 'ready',
          error: null,
        })
      }
      return { output: {} }
    } catch (error) {
      // Do not expose command stderr, paths, tokens, or provider response bodies to editors.
      payload.logger.error(
        { err: error, productionId: production.id },
        'Sermon audio preparation failed',
      )
      await finish({
        status: 'failed',
        error:
          'Audio preparation failed. Check the source recording and intro/outro settings, then retry.',
      })
      return { output: {} }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
}
