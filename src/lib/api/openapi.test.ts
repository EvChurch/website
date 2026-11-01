import { expect, it } from 'vitest'
import { GET } from '@/app/api/v1/openapi.json/route'
import { apiSpecifications } from './docs'

it('publishes a version-wide specification with namespaced operation paths', async () => {
  const response = GET()
  const spec = await response.json()
  expect(response.status).toBe(200)
  expect(response.headers.get('X-Robots-Tag')).toContain('noindex')
  expect(spec.info.title).toBe('Ev Church API')
  expect(spec.servers).toEqual([{url:'/api/v1'}])
  expect(spec.paths['/reimbursements/reports'].get.operationId).toBe('listReports')
  expect(spec.paths['/reimbursements/payments/confirm'].post.operationId).toBe('confirmPayments')
  expect(Object.keys(spec.paths).every(path => path.startsWith('/reimbursements/'))).toBe(true)
  expect(apiSpecifications).toEqual([{name:'API v1',url:'/api/v1/openapi.json'}])
})
