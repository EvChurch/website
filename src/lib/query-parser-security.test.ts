// @vitest-environment node

import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const payloadRequire = createRequire(import.meta.resolve('@payloadcms/plugin-mcp'))
const mcpRequire = createRequire(payloadRequire.resolve('@modelcontextprotocol/sdk/server/index.js'))
const expressRequire = createRequire(mcpRequire.resolve('express'))
const blinkRequire = createRequire(import.meta.resolve('blink-debit-api-client-node'))

interface QueryParser {
  parse: (source: string, options?: { comma?: boolean; arrayLimit?: number; throwOnLimitExceeded?: boolean; plainObjects?: boolean }) => unknown
  stringify: (value: unknown) => string
}

for (const [name, dependencyRequire] of [['Payload MCP Express', expressRequire], ['BlinkPay SDK', blinkRequire]] as const) {
  const qs: QueryParser = dependencyRequire('qs')

  describe(`${name} resolved query parser`, () => {
    it('enforces the configured array limit for bracketed comma groups', () => {
      expect(() => qs.parse('a[]=1,2,3,4', {
        comma: true, arrayLimit: 3, throwOnLimitExceeded: true,
      })).toThrow(RangeError)
    })

    it('round-trips untrusted constructor fields without invoking a non-callable isBuffer', () => {
      const parsed = qs.parse('x%5Bconstructor%5D%5BisBuffer%5D=y', { plainObjects: true })
      expect(qs.stringify(parsed)).toBe('x%5Bconstructor%5D%5BisBuffer%5D=y')
    })

    it('preserves nested payment form serialization and repeated query values', () => {
      const payment = {
        amount: { total: '12.34', currency: 'NZD' },
        flow: { detail: { type: 'gateway', redirect_uri: 'https://www.ev.church/give/return' } },
      }
      expect(qs.parse(qs.stringify(payment))).toEqual(payment)
      expect(qs.parse('fund=GENERAL&fund=EV123')).toEqual({ fund: ['GENERAL', 'EV123'] })
    })
  })
}
