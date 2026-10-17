import { describe, expect, it } from 'vitest'
import { reimbursementReportPath, reimbursementRoute, reimbursementViewPaths } from './paths'

const id = '00000000-0000-4000-8000-000000000001'
describe('reimbursement paths', () => {
  it.each(Object.entries(reimbursementViewPaths))('resolves the %s view', (view, href) => {
    expect(reimbursementRoute(href.split('/').slice(3))).toEqual({ view })
  })
  it('resolves individual report paths', () => {
    expect(reimbursementReportPath(id)).toBe(`/members/reimbursements/reports/${id}`)
    expect(reimbursementRoute(['reports', id])).toEqual({ view: 'mine', reportId: id })
  })
  it.each([['unknown'], ['approvals', 'extra'], ['reports'], ['reports', 'not-a-report'], ['reports', id, 'extra']])('rejects unknown paths %j', (...path) => {
    expect(reimbursementRoute(path)).toBeNull()
  })
})
