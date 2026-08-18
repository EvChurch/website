import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { CollectionBeforeOperationHook } from 'payload'

import { hasPayloadAdminRole } from '@/access/roles'
import type { Media, User } from '@/payload-types'

type StoredMedia = Media & {
  prefix?: string | null
}

function getS3Client() {
  return new S3Client({
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    region: process.env.S3_REGION || 'auto',
    ...(process.env.S3_ENDPOINT
      ? { endpoint: process.env.S3_ENDPOINT }
      : {}),
  })
}

export const loadMediaFileForFocalPoint: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  const bucket = process.env.S3_BUCKET
  const uploadEdits = req.query?.uploadEdits
  const id =
    'id' in args &&
    (typeof args.id === 'string' || typeof args.id === 'number')
      ? args.id
      : null

  if (
    operation !== 'update' ||
    req.file ||
    !bucket ||
    !hasPayloadAdminRole(req.user as User | null) ||
    id === null ||
    !uploadEdits ||
    typeof uploadEdits !== 'object' ||
    !('focalPoint' in uploadEdits) ||
    !uploadEdits.focalPoint ||
    typeof uploadEdits.focalPoint !== 'object'
  ) {
    return args
  }

  const focalPoint = uploadEdits.focalPoint as { x?: unknown; y?: unknown }
  const media = (await req.payload.findByID({
    collection: 'media',
    id,
    depth: 0,
    overrideAccess: true,
    req,
  })) as StoredMedia

  if (
    typeof focalPoint.x !== 'number' ||
    typeof focalPoint.y !== 'number' ||
    (focalPoint.x === media.focalX && focalPoint.y === media.focalY) ||
    typeof media.filename !== 'string' ||
    typeof media.mimeType !== 'string' ||
    !media.mimeType.startsWith('image/')
  ) {
    return args
  }

  const key = media.prefix ? `${media.prefix}/${media.filename}` : media.filename
  const object = await getS3Client().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  )

  if (!object.Body) {
    throw new Error(`S3 object ${key} did not include a response body`)
  }

  const fileData = Buffer.from(await object.Body.transformToByteArray())
  req.file = {
    data: fileData,
    mimetype: media.mimeType,
    name: media.filename,
    size: fileData.length,
  }
  args.overwriteExistingFiles = true

  return args
}
