import type { GivingEnvironment } from '../contracts'
import { createBlinkPayClient } from './client'
import { loadBlinkPayConfig } from './config'

export function createBlinkPayRuntimeClientRegistry(dependencies: {
  loadConfig?: typeof loadBlinkPayConfig
  createClient?: typeof createBlinkPayClient
} = {}) {
  const loadConfig = dependencies.loadConfig ?? loadBlinkPayConfig
  const createClient = dependencies.createClient ?? createBlinkPayClient
  const clients = new Map<GivingEnvironment, ReturnType<typeof createBlinkPayClient>>()
  return (environment: GivingEnvironment) => {
    const existing = clients.get(environment)
    if (existing) return existing
    const config = loadConfig(environment)
    if (config.environment !== environment) throw new Error('BlinkPay environment mismatch')
    const client = createClient({ config })
    clients.set(environment, client)
    return client
  }
}

export const getBlinkPayRuntimeClient = createBlinkPayRuntimeClientRegistry()
