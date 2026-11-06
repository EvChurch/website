import { getPayload } from 'payload'
import config from '@payload-config'

let payloadClient: ReturnType<typeof getPayload> | null = null

export const getPayloadClient = () => {
  payloadClient ??= getPayload({
    config,
    cron: process.env.PAYLOAD_CRON_ENABLED !== 'false',
  })
  return payloadClient
}

export async function destroyPayloadClient(): Promise<void> {
  if (!payloadClient) return

  const client = await payloadClient
  payloadClient = null
  await client.destroy()
}
