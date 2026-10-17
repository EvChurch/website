import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReimbursementEmail, type ReimbursementEmailSource } from './email'
import { sendReimbursementEmail } from './notifications'
import type { Report } from './model'

const report: Report = {
  id: '00000000-0000-4000-8000-000000000043', number: 43, claimantId: 1,
  claimantName: 'Aroha <Ngata>', claimantEmail: 'aroha@example.com', centreId: 1,
  centreName: 'Food & hospitality', status: 'awaiting-payment', version: 1, revision: 1,
  accountName: 'Aroha account', accountNumber: '12-1234-1234567-000', rcApproverId: 2,
  createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', history: [],
  lines: [{ id: '00000000-0000-4000-8000-000000000044', date: '2026-10-16', categoryId: 1, description: 'Lunch', amountMinor: 11500, hasGst: true, receiptHash: null }],
}
const source: ReimbursementEmailSource = { kind: 'rc', recipient: 'hannah@example.com', subject: 'EXP-000043 needs your approval', body: 'Report summary', include_payment: false, include_pdf: false }
const build = (changes: Partial<ReimbursementEmailSource> = {}) => buildReimbursementEmail({ ...source, ...changes }, report, 'https://www.ev.church')

describe('reimbursement email presentation', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it.each([
    ['rc', 'Review report'], ['rc-reminder-123', 'Review report'], ['finance', 'Review report'],
    ['payment', 'Review payment'], ['payment-reminder-123', 'Review payment'],
    ['approved', 'View report'], ['rc-payment', 'View report'], ['rejected', 'Edit report'], ['paid', 'View report'],
  ])('renders %s with a link to the authenticated report, without performing the action', (kind, label) => {
    const message = build({ kind })
    expect(message.html).toContain(`>${label}</a>`)
    expect(message.html).toContain(`href="https://www.ev.church/members/reimbursements?report=${report.id}"`)
    expect(message.html).toContain('src="https://www.ev.church/images/global/ev-church-logo.png"')
    expect(message.html).not.toContain('>Reimbursements</p>')
    expect(message.html).toContain('Aroha &lt;Ngata&gt;')
    expect(message.html).toContain('Food &amp; hospitality')
    expect(message.html).toContain('$115.00 NZD')
    expect(message.html).not.toContain('<form')
  })

  it('escapes rejection feedback and makes it prominent', () => {
    const message = build({ kind: 'rejected', body: 'Summary\n\nReason: <script>alert("x")</script>\nSecond line\n\nYou can edit and resubmit the report.' })
    expect(message.html).toContain('What needs changing')
    expect(message.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;\nSecond line')
    expect(message.html).not.toContain('<script>')
    expect(message.text).toContain('Reason: <script>')
  })

  it('includes bank details only in deliveries explicitly configured to contain them', () => {
    for (const kind of ['rc', 'finance', 'approved', 'rc-payment', 'rejected']) {
      const message = build({ kind, include_pdf: kind === 'rc-payment' })
      expect(message.html).not.toContain(report.accountNumber)
      expect(message.text).not.toContain(report.accountNumber)
    }
    const message = build({ kind: 'payment', include_payment: true, include_pdf: true })
    expect(message.html).toContain(report.accountNumber)
    expect(message.text).toContain(`Account number: ${report.accountNumber}`)
    expect(message.html).toContain('Attached: expense report PDF')
    expect(message.text).toBe(`Report summary\n\nAccount holder: Aroha account\nAccount number: 12-1234-1234567-000\nAmount: $115.00 NZD\n\nOpen report: https://www.ev.church/members/reimbursements?report=${report.id}\n\nEv Church website team`)
  })

  it('sends the HTML and plain-text alternatives alongside the existing attachment', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key'); vi.stubEnv('REIMBURSEMENT_EMAIL_FROM', 'Ev Church <test@example.com>')
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ id: 'preview-provider-id' })))
    vi.stubGlobal('fetch', fetcher)
    const message = { ...build(), pdf: Buffer.from('sample PDF'), filename: 'EXP-000043.pdf' }
    await sendReimbursementEmail(message, 'test-idempotency')
    const payload = JSON.parse(String(fetcher.mock.calls[0][1]?.body))
    expect(payload.html).toBe(message.html)
    expect(payload.text).toBe(message.text)
    expect(payload.attachments).toEqual([{ filename: message.filename, content: message.pdf.toString('base64') }])
  })
})
