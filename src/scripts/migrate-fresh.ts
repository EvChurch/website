/**
 * Programmatic migrate:fresh that skips the interactive confirmation prompt.
 * Drops all tables and re-runs every migration from scratch.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })
const db = payload.db as unknown as { migrateFresh: (opts: { forceAcceptWarning: boolean }) => Promise<void> }
await db.migrateFresh({ forceAcceptWarning: true })
process.exit(0)
