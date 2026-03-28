import { getPayload } from 'payload'
import config from '@payload-config'

async function clearMedia() {
  const payload = await getPayload({ config })

  const media = await payload.find({ collection: 'media', limit: 200 })
  console.log(`Found ${media.docs.length} media docs, deleting...`)

  for (const doc of media.docs) {
    await payload.delete({ collection: 'media', id: doc.id })
    console.log(`  Deleted: ${doc.id}`)
  }

  console.log('Done.')
  process.exit(0)
}

clearMedia()
