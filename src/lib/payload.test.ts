import { expect, it, vi } from 'vitest'

const { getPayload, destroy } = vi.hoisted(() => {
  const destroy = vi.fn(async () => {})
  return { destroy, getPayload: vi.fn(async () => ({ destroy })) }
})

vi.mock('payload', () => ({ getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))

import { destroyPayloadClient, getPayloadClient } from './payload'

it('starts scheduled jobs once for the shared client and closes it on shutdown', async () => {
  const first = getPayloadClient()
  expect(getPayloadClient()).toBe(first)
  await first
  expect(getPayload).toHaveBeenCalledExactlyOnceWith({ config: {}, cron: true })

  await destroyPayloadClient()
  expect(destroy).toHaveBeenCalledOnce()
  await getPayloadClient()
  expect(getPayload).toHaveBeenCalledTimes(2)
  await destroyPayloadClient()
})
