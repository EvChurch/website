import { reimbursementReportPath } from './paths'
import { money, reportNumber, type Report } from './model'

export interface ReimbursementEmailSource {
  kind: string
  recipient: string
  subject: string
  body: string
  include_payment: boolean
  include_pdf: boolean
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

/** Both email formats use the delivery snapshot; rendering never performs an approval or payment. */
export function buildReimbursementEmail(source: ReimbursementEmailSource, report: Report, baseUrl: string) {
  const url = new URL(reimbursementReportPath(report.id), baseUrl).toString()
  const total = `${money(report.lines.reduce((sum, line) => sum + (line.amountMinor ?? 0), 0))} NZD`
  const payment = source.include_payment ? `\n\nAccount holder: ${report.accountName}\nAccount number: ${report.accountNumber}\nAmount: ${total}` : ''
  const kind = source.kind.replace(/-reminder.*$/u, '')
  const copy = {
    rc: ['Your approval is needed', 'Please review this expense report and approve it or let the claimant know what needs changing.', 'Review report'],
    finance: ['Ready for finance approval', 'The purpose approval is complete. Please review this expense report before it moves to payment.', 'Review report'],
    payment: ['Ready for payment', 'This expense report has been approved. Use the payment details below, then confirm payment on the website once it has been made.', 'Review payment'],
    approved: ['Your report is approved', 'Your expense report has been approved and is now awaiting payment. We’ll email you when finance confirms it has been paid.', 'View report'],
    'rc-payment': ['Approved for payment', 'This expense report has completed approval and is now awaiting payment. A summary is attached for your records.', 'View report'],
    rejected: ['Your report needs changes', 'Please review the feedback below, edit your report, and resubmit it when it’s ready. The approval process will restart.', 'Edit report'],
    paid: ['Your reimbursement is paid', 'Finance has confirmed payment of your expense report. Your remittance advice is attached for your records.', 'View report'],
  } satisfies Record<string, [string, string, string]>
  const [heading, intro, action] = copy[kind as keyof typeof copy] ?? ['Expense report update', 'There is an update to your expense report.', 'View report']
  const reason = kind === 'rejected' ? source.body.split('\n\nReason: ')[1]?.split('\n\nYou can edit')[0] ?? '' : ''
  const row = (label: string, value: string) => `<tr><th scope="row" style="padding:9px 0;text-align:left;vertical-align:top;font-size:14px;font-weight:400;color:#71686b;width:35%">${escapeHtml(label)}</th><td style="padding:9px 0 9px 12px;text-align:right;vertical-align:top;overflow-wrap:anywhere;font-size:15px;font-weight:600">${escapeHtml(value)}</td></tr>`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(source.subject)}</title></head><body style="margin:0;padding:0;background:#FEFAF4;color:#0F0004;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(heading)} · ${escapeHtml(reportNumber(report.number))} · ${escapeHtml(total)}</div><table role="presentation" style="width:100%;border-collapse:collapse;background:#FEFAF4"><tr><td style="padding:32px 16px"><table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-spacing:0;background:#ffffff;border:1px solid #e8e0d9;border-radius:20px;overflow:hidden"><tr><td style="padding:26px 28px;border-top:5px solid #E22A30;border-bottom:1px solid #eee8e3"><img src="https://www.ev.church/images/global/ev-church-logo.png" alt="Ev Church" width="56" height="56" style="display:block;width:56px;height:56px;border:0"></td></tr><tr><td style="padding:28px"><h1 style="font-size:28px;line-height:1.2;letter-spacing:-.6px;margin:0 0 16px">${escapeHtml(heading)}</h1><p style="font-size:16px;line-height:1.65;color:#5c5356;margin:0 0 24px">${escapeHtml(intro)}</p>${reason ? `<div style="border-left:4px solid #E22A30;background:#fff3f1;padding:16px 18px;margin:0 0 24px"><strong style="font-size:14px">What needs changing</strong><p style="margin:8px 0 0;font-size:16px;line-height:1.6;white-space:pre-wrap">${escapeHtml(reason)}</p></div>` : ''}<table style="width:100%;border-collapse:collapse">${row('Report', reportNumber(report.number))}${row('Claimant', report.claimantName)}${row('Purpose', report.centreName)}<tr><th scope="row" style="border-top:1px solid #e8e0d9;text-align:left;padding:18px 0;font-size:15px">Total</th><td style="border-top:1px solid #e8e0d9;text-align:right;padding:18px 0 18px 12px;font-size:24px;font-weight:700">${escapeHtml(total)}</td></tr></table>${source.include_payment ? `<div style="background:#f8f5f0;border-radius:12px;padding:18px;margin:8px 0 24px"><h2 style="font-size:16px;margin:0 0 10px">Payment details</h2><table style="width:100%;border-collapse:collapse">${row('Account holder', report.accountName)}${row('Account number', report.accountNumber)}</table></div>` : ''}<p style="margin:20px 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#E22A30;color:#ffffff;border-radius:999px;padding:15px 24px;text-decoration:none;font-size:16px;font-weight:700">${escapeHtml(action)}</a></p>${source.include_pdf ? '<p style="font-size:14px;line-height:1.6;color:#71686b;margin:0 0 20px">Attached: expense report PDF with receipts on the following pages.</p>' : ''}<p style="font-size:13px;line-height:1.6;color:#71686b;margin:0">You’ll be asked to log in to view this report.</p></td></tr><tr><td style="padding:20px 28px;border-top:1px solid #eee8e3;font-size:13px;line-height:1.6;color:#71686b">Ev Church website team<br><a href="${escapeHtml(new URL('/contact', baseUrl).toString())}" style="color:#71686b;text-decoration:underline">Need a hand? Get in touch</a></td></tr></table></td></tr></table></body></html>`
  return { to: source.recipient, subject: source.subject, text: `${source.body}${payment}\n\nOpen report: ${url}\n\nEv Church website team`, html }
}
