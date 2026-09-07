import { readFile } from 'node:fs/promises'
import { getPayload } from 'payload'

const [settingsPath, expectedDatabase] = process.argv.slice(2)
if (!settingsPath || !expectedDatabase) throw new Error('Usage: tsx scripts/configure-sermon-manager.ts <settings.json> <expected-database-name>')
const database = new URL(process.env.DATABASE_URL || '')
if (decodeURIComponent(database.pathname.slice(1)) !== expectedDatabase) throw new Error('Target database does not match the explicit expected database.')
interface SettingsInput { outroPath: string; folders: Array<{ campusSlug: string; folderId: string }> }
const input = JSON.parse(await readFile(settingsPath, 'utf8')) as SettingsInput
if (!input.outroPath || !Array.isArray(input.folders) || input.folders.some((f) => !/^[\w-]+$/.test(f.folderId))) throw new Error('Invalid settings file.')
const { default: configPromise } = await import('../payload.config')
const config = await configPromise
config.jobs.autoRun = []
const payload = await getPayload({ config })
try {
  const folders = []
  for (const folder of input.folders) {
    const result = await payload.find({ collection: 'campuses', depth: 0, limit: 2, where: { slug: { equals: folder.campusSlug } } })
    if (result.docs.length !== 1) throw new Error(`Campus ${folder.campusSlug} was not found uniquely.`)
    folders.push({ campus: result.docs[0].id, folderId: folder.folderId })
  }
  const current = await payload.findGlobal({ slug: 'sermon-settings', depth: 0 })
  const outro = current.outro || (await payload.create({ collection: 'sermon-work-files', filePath: input.outroPath, data: {} })).id
  await payload.updateGlobal({ slug: 'sermon-settings', data: { intro: null, outro, driveFolders: folders } })
  const saved = await payload.findGlobal({ slug: 'sermon-settings', depth: 0 })
  console.log(JSON.stringify({ database: expectedDatabase, outroConfigured: !!saved.outro, introConfigured: !!saved.intro, folders: saved.driveFolders?.length }))
} finally { await payload.destroy() }

process.exit(0)
