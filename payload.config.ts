import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'

// Collections
import { Users } from '@/collections/Users'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { BlogPosts } from '@/collections/BlogPosts'
import { Announcements } from '@/collections/Announcements'
import { Campuses } from '@/collections/Campuses'
import { TeamMembers } from '@/collections/TeamMembers'
import { Events } from '@/collections/Events'
import { SermonSeries } from '@/collections/SermonSeries'
import { Sermons } from '@/collections/Sermons'
import { Speakers } from '@/collections/Speakers'
import { Topics } from '@/collections/Topics'
import { Categories } from '@/collections/Categories'
import { Scriptures } from '@/collections/Scriptures'
import { SermonAudio } from '@/collections/SermonAudio'
import { ConnectGroups } from '@/collections/ConnectGroups'
import { Registrations } from '@/collections/Registrations'
import { ServiceGuideItems } from '@/collections/ServiceGuideItems'
import { ConnectGroupParticipants } from '@/collections/ConnectGroupParticipants'
import { ConnectGroupLeaderResources } from '@/collections/ConnectGroupLeaderResources'
import { DailyBibleReadings } from '@/collections/DailyBibleReadings'
import { MissingPaths } from '@/collections/MissingPaths'
import { SiteFeedback } from '@/collections/SiteFeedback'

// Globals
import { Navigation } from '@/globals/Navigation'
import { SiteSettings } from '@/globals/SiteSettings'
import { ServiceGuideSyncState } from '@/globals/ServiceGuideSyncState'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const payloadSecret = process.env.PAYLOAD_SECRET?.trim()
if (
  process.env.NODE_ENV === 'production' &&
  (!payloadSecret || /change-me|replace-me|generate-with/i.test(payloadSecret))
) {
  throw new Error('PAYLOAD_SECRET must be configured with a non-placeholder value')
}

export default buildConfig({
  secret: payloadSecret || 'development-only-payload-secret-not-for-production',

  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      beforeLogin: ['@/components/admin/Auth0BeforeLogin'],
      logout: {
        Button: '@/components/admin/Auth0LogoutButton',
      },
    },
  },

  db: postgresAdapter({
    migrationDir: path.resolve(dirname, 'src/migrations'),
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),

  editor: lexicalEditor({}),

  sharp,

  collections: [
    // Auth + media
    Users,
    Media,
    // Content (block editor)
    Pages,
    BlogPosts,
    Announcements,
    // Synced from Rock RMS
    Campuses,
    TeamMembers,
    Events,
    ConnectGroups,
    ConnectGroupParticipants,
    ConnectGroupLeaderResources,
    DailyBibleReadings,
    MissingPaths,
    SiteFeedback,
    Registrations,
    ServiceGuideItems,
    // Synced from resources.ev.church GraphQL API
    SermonSeries,
    Sermons,
    Speakers,
    Topics,
    Categories,
    Scriptures,
    SermonAudio,
  ],

  globals: [Navigation, SiteSettings, ServiceGuideSyncState],

  plugins: [
    ...(process.env.S3_BUCKET
      ? [
          s3Storage({
            collections: {
              media: true,
              'sermon-audio': true,
            },
            bucket: process.env.S3_BUCKET,
            config: {
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
              },
              region: process.env.S3_REGION || 'auto',
              ...(process.env.S3_ENDPOINT
                ? { endpoint: process.env.S3_ENDPOINT }
                : {}),
            },
          }),
        ]
      : []),
  ],

  jobs: {
    tasks: [
      {
        slug: 'fullSermonSync',
        retries: 2,
        inputSchema: [],
        outputSchema: [
          { name: 'created', type: 'number' },
          { name: 'updated', type: 'number' },
          { name: 'errors', type: 'number' },
        ],
        handler: async ({ req }) => {
          const { runSermonSync } = await import('@/sync/sermon-sync-runner')
          const results = await runSermonSync()
          const created = results.reduce((s, r) => s + r.created, 0)
          const updated = results.reduce((s, r) => s + r.updated, 0)
          const errors = results.reduce((s, r) => s + r.errors.length, 0)
          req.payload.logger.info(`[SermonSync] created=${created} updated=${updated} errors=${errors}`)
          return { output: { created, updated, errors } }
        },
      },
      {
        slug: 'youtubeSync',
        retries: 2,
        inputSchema: [],
        outputSchema: [
          { name: 'matched', type: 'number' },
          { name: 'unmatched', type: 'number' },
          { name: 'errors', type: 'number' },
        ],
        handler: async ({ req }) => {
          const { runYouTubeSync } = await import('@/pipeline/youtube-sync-runner')
          const result = await runYouTubeSync(req.payload)
          return { output: { matched: result.matched, unmatched: result.unmatched, errors: result.errors } }
        },
      },
      {
        slug: 'transcriptSync',
        retries: 1,
        inputSchema: [],
        outputSchema: [
          { name: 'processed', type: 'number' },
          { name: 'transcribed', type: 'number' },
          { name: 'boundariesSet', type: 'number' },
          { name: 'errors', type: 'number' },
        ],
        handler: async ({ req }) => {
          const { runTranscriptSync } = await import('@/pipeline/transcript-sync-runner')
          const result = await runTranscriptSync(req.payload)
          return {
            output: {
              processed: result.processed,
              transcribed: result.transcribed,
              boundariesSet: result.boundariesSet,
              errors: result.errors,
            },
          }
        },
      },
    ],
    autoRun: [
      { cron: '*/15 * * * *', queue: 'default', limit: 10 },
      { cron: '0 6 * * 1', queue: 'pipeline', limit: 5 },
    ],
  },

  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
})
