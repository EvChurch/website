import { describe, expect, it, vi } from 'vitest'

import { notifyHeartbeat } from './better-stack-heartbeat'

describe('notifyHeartbeat', () => {
  it('does nothing when no heartbeat URL is configured', async () => {
    const fetchImpl = vi.fn()

    await expect(notifyHeartbeat(undefined, 'success', { fetchImpl })).resolves.toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('pings the configured URL after a successful job', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await expect(
      notifyHeartbeat('https://uptime.example/heartbeat/token', 'success', { fetchImpl }),
    ).resolves.toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://uptime.example/heartbeat/token',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('uses the failure endpoint without leaking the job error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await notifyHeartbeat('https://uptime.example/heartbeat/token', 'failure', { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://uptime.example/heartbeat/token/fail',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('reports delivery failure without failing the monitored job', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network unavailable'))
    const warn = vi.fn()

    await expect(
      notifyHeartbeat('https://uptime.example/heartbeat/token', 'success', {
        fetchImpl,
        warn,
      }),
    ).resolves.toBe(false)
    expect(warn).toHaveBeenCalledWith('Better Stack heartbeat delivery failed')
  })
})
