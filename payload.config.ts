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

// Globals
import { Navigation } from '@/globals/Navigation'
import { SiteSettings } from '@/globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'CHANGE-ME-IN-ENV',

  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },

  db: postgresAdapter({
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
    Registrations,
    // Synced from resources.ev.church GraphQL API
    SermonSeries,
    Sermons,
    Speakers,
    Topics,
    Categories,
    Scriptures,
    SermonAudio,
  ],

  globals: [Navigation, SiteSettings],

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

  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
})
