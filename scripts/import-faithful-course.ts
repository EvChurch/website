import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Client } from 'pg'
import { faithfulWithMoneyCourse } from '../content/courses/faithful-with-money'
import { assertLocalCourseImportDatabase, assertLocalCourseImportTarget } from './course-import-target'

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 2 && args[0] === '--export') {
    await writeFile(resolve(args[1]), JSON.stringify(faithfulWithMoneyCourse, null, 2) + '\n')
    console.log('Wrote draft course authoring payload; no database connection made.')
    return
  }
  if (args.length !== 1 || args[0] !== '--local') throw new Error('Use --export <file.json> or --local (ev_courses_dev only).')
  process.loadEnvFile(resolve('.env.local'))
  process.env.PAYLOAD_CRON_ENABLED = 'false'
  assertLocalCourseImportTarget(process.env.DATABASE_URL)
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const { rows } = await client.query<{ database: string; address: string | null }>('SELECT current_database() AS database, inet_server_addr()::text AS address')
    assertLocalCourseImportDatabase(rows[0].database, rows[0].address)
  } finally { await client.end() }

  // Config is loaded only after both independent target checks pass.
  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')
  const payload = await getPayload({ config, cron: false })
  try {
    const existing = await payload.find({ collection: 'courses', where: { slug: { equals: faithfulWithMoneyCourse.slug } }, limit: 1, depth: 0, draft: true, overrideAccess: true })
    const course = existing.docs[0] ?? await payload.create({ collection: 'courses', data: faithfulWithMoneyCourse, draft: true, overrideAccess: true })
    const saved = await payload.findByID({ collection: 'courses', id: course.id, depth: 0, draft: true, overrideAccess: true })
    console.log(`${existing.docs.length ? 'Retained existing course without changes' : 'Created draft'}: ${saved.id}, ${saved.lessons.length} lessons, status ${saved._status}`)
    console.log(`Preview: /members/courses/${saved.slug}/preview`)
  } finally { await payload.destroy() }
}

main().then(() => process.exit(0), error => { console.error(error); process.exit(1) })
