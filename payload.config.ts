import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig, type CollectionConfig, type GlobalConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { mcpPlugin, type MCPPluginConfig } from '@payloadcms/plugin-mcp'
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
import { LeaderResourceShares } from '@/collections/LeaderResourceShares'
import { GivingFunds } from '@/collections/GivingFunds'
import { GivingGivers } from '@/collections/GivingGivers'
import { GivingCheckouts } from '@/collections/GivingCheckouts'
import { GivingGifts } from '@/collections/GivingGifts'
import { GivingConsents } from '@/collections/GivingConsents'
import { GivingSchedules } from '@/collections/GivingSchedules'
import { GivingProviderOperations } from '@/collections/GivingProviderOperations'
import { GivingE2ERuns } from '@/collections/GivingE2ERuns'
import { BlinkPayWebhookEvents } from '@/collections/BlinkPayWebhookEvents'
import { isAdmin } from '@/access/roles'

// Globals
import { Navigation } from '@/globals/Navigation'
import { SiteSettings } from '@/globals/SiteSettings'
import { ServiceGuideSyncState } from '@/globals/ServiceGuideSyncState'
import {
  notificationJobConfigs,
  SITE_FEEDBACK_NOTIFICATION_AUTO_RUN,
} from '@/jobs/site-feedback-notification'
import { givingJobConfigs } from '@/jobs/giving'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export function restrictMcpApiKeyCollection(
  collection: CollectionConfig,
): CollectionConfig {
  return {
    ...collection,
    access: {
      create: isAdmin,
      read: isAdmin,
      update: isAdmin,
      delete: isAdmin,
    },
  }
}

export const applicationCollections: CollectionConfig[] = [
  Users,
  Media,
  Pages,
  BlogPosts,
  Announcements,
  Campuses,
  TeamMembers,
  Events,
  ConnectGroups,
  ConnectGroupParticipants,
  ConnectGroupLeaderResources,
  DailyBibleReadings,
  MissingPaths,
  SiteFeedback,
  LeaderResourceShares,
  Registrations,
  ServiceGuideItems,
  SermonSeries,
  Sermons,
  Speakers,
  Topics,
  Categories,
  Scriptures,
  SermonAudio,
  GivingFunds,
  GivingGivers,
  GivingCheckouts,
  GivingGifts,
  GivingConsents,
  GivingSchedules,
  GivingProviderOperations,
  GivingE2ERuns,
  BlinkPayWebhookEvents,
]

export const applicationGlobals: GlobalConfig[] = [
  Navigation,
  SiteSettings,
  ServiceGuideSyncState,
]

export const mcpExcludedCollectionSlugs = new Set([
  'leader-resource-shares',
  'giving-funds',
  'giving-givers',
  'giving-checkouts',
  'giving-gifts',
  'giving-consents',
  'giving-schedules',
  'giving-provider-operations',
  'giving-e2e-runs',
  'blinkpay-webhook-events',
])

function enableMcpEntities<T extends { slug: string }>(entities: T[]) {
  return Object.fromEntries(
    entities.map(({ slug }) => [slug, { enabled: true as const }]),
  )
}

export const mcpCollections = enableMcpEntities(
  applicationCollections.filter(({ slug }) => !mcpExcludedCollectionSlugs.has(slug)),
) satisfies NonNullable<
  MCPPluginConfig['collections']
>

export const mcpGlobals = enableMcpEntities(applicationGlobals) satisfies NonNullable<
  MCPPluginConfig['globals']
>

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
      afterNavLinks: ['@/components/admin/MemberImpersonationNavLink'],
      logout: {
        Button: '@/components/admin/Auth0LogoutButton',
      },
      views: {
        memberImpersonation: {
          Component: '@/components/admin/MemberImpersonationView#MemberImpersonationView',
          exact: true,
          path: '/impersonate',
        },
      },
    },
  },

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),

  editor: lexicalEditor({}),

  sharp,

  collections: [...applicationCollections],

  globals: [...applicationGlobals],

  plugins: [
    mcpPlugin({
      collections: mcpCollections,
      globals: mcpGlobals,
      overrideApiKeyCollection: restrictMcpApiKeyCollection,
    }),
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
      ...notificationJobConfigs,
      ...givingJobConfigs,
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
      SITE_FEEDBACK_NOTIFICATION_AUTO_RUN,
      { cron: '*/15 * * * *', queue: 'default', limit: 10 },
      { cron: '0 6 * * 1', queue: 'pipeline', limit: 5 },
    ],
  },

  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
})
