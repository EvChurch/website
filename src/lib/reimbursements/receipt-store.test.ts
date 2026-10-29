import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { ReceiptValidationError } from './receipts'

const pdf = vi.hoisted(() => ({ build: vi.fn(), load: vi.fn() }))
vi.mock('./pdf', () => ({ buildReportPdf: pdf.build, loadReportReceipts: pdf.load }))
import { actOnReport, uploadReceipt } from './store'

const actor = { personId: 1, name: 'Claimant', email: 'claimant@example.com', finance: false, admin: false }

describe('receipt store boundaries', () => {
  it('does not store a corrupt receipt or create ownership for it', async () => {
    const connect = vi.fn()
    const pool = { connect } as unknown as Pool
    await expect(uploadReceipt(pool, actor, Buffer.from('%PDF-invalid'), 'receipt.pdf', 'application/pdf')).rejects.toMatchObject({ status: 400, message: expect.stringContaining('could not be read') })
    expect(connect).not.toHaveBeenCalled()
  })

  it('rolls submission back with an actionable error if attachment preflight fails', async () => {
    const now = new Date()
    const row = { id: '00000000-0000-4000-8000-000000000001', number: 1, claimant_id: 1, claimant_name: actor.name, claimant_email: actor.email,
      status: 'draft', version: 1, revision: 0, history: [], campus_id: 1, campus_name: 'North', centre_id: 1, centre_name: 'Hospitality', account_name: '', account_number: '', rc_approver_id: null, created_at: now, updated_at: now,
      lines: [{ id: '00000000-0000-4000-8000-000000000002', date: '2026-10-17', categoryId: 1, description: 'Lunch', amountMinor: 11500, hasGst: true, receiptHash: 'a'.repeat(64) }] }
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM reimbursement_reports')) return { rows: [row] }
      if (sql.includes('FROM responsibility_centres')) return { rows: [{ id: 1, name: 'Hospitality', approverRockPersonId: '2', approverName: 'Approver', approverEmail: 'approver@example.com' }] }
      if (sql.includes('FROM campuses')) return { rows: [{ id: 1, name: 'North' }] }
      if (sql.includes('FROM reimbursement_categories')) return { rows: [{ id: 1, name: 'Meals', archived: false }] }
      if (sql.includes('FROM reimbursement_settings')) return { rows: [{ data: { financeEmail: 'finance@example.com' } }] }
      if (sql.includes('FROM reimbursement_profiles')) return { rows: [{ account_name: 'Claimant', account_number: '12-1234-1234567-000' }] }
      return { rows: [] }
    })
    const release = vi.fn()
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) } as unknown as Pool
    pdf.load.mockResolvedValue([])
    pdf.build.mockRejectedValue(new ReceiptValidationError('Receipts together must be 50 pages or fewer. Split the expenses into separate reports.'))
    await expect(actOnReport(pool, actor, row.id, { action: 'submit', version: 1 })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Split the expenses') })
    expect(pdf.build).toHaveBeenCalled()
    expect(pdf.build.mock.calls.at(-1)?.[4]).toBe('submission')
    expect(query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK')
    expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE reimbursement_reports'))).toBe(false)
    expect(release).toHaveBeenCalledOnce()
  })
})
