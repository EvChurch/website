import { createServer } from 'node:http'

import { buildGivingEmail, type GivingEmailSource } from '../src/lib/giving/email'

const port = Number(process.env.GIVING_EMAIL_PREVIEW_PORT ?? 3010)
const previewDate = new Date('2026-09-01T00:00:00Z')
const bankTransferThankYouId = 'bank-transfer-thank-you-recurring'

function source(
  kind: GivingEmailSource['kind'],
  frequency: GivingEmailSource['frequency'] = 'monthly',
): GivingEmailSource {
  return {
    id: 1,
    checkoutId: 123,
    kind,
    email: 'preview@example.com',
    name: 'Alex Preview',
    bankReference: 'EV12345',
    bankCode: 'APREVIEW',
    fundCode: 'GEN',
    fundName: 'General',
    amountMinor: 5000,
    transactionFeeMinor: kind === 'blinkpay-thanks' ? 50 : 0,
    frequency,
    firstPaymentDate: frequency === 'one-off' ? null : '2026-09-01',
    leaseToken: 'preview',
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character)
}

function emailDocument(html: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="box-sizing:border-box;margin:0;padding:32px;background:#fff;color:#0F0004;font-family:Arial,sans-serif;font-size:16px;line-height:1.5">${html}</body></html>`
}

function page() {
  const previews = [
    ['bank-transfer-details', 'Bank-transfer details', buildGivingEmail(source('bank-transfer-details'), previewDate, {
      acknowledgementUrl: `http://localhost:${port}/#${bankTransferThankYouId}`,
    })],
    ['bank-transfer-thank-you-one-off', 'Bank-transfer thank you — one-off', buildGivingEmail(source('bank-transfer-thanks', 'one-off'), previewDate)],
    [bankTransferThankYouId, 'Bank-transfer thank you — recurring', buildGivingEmail(source('bank-transfer-thanks'), previewDate)],
    ['blinkpay-thank-you-one-off', 'BlinkPay thank you — one-off', buildGivingEmail(source('blinkpay-thanks', 'one-off'), previewDate)],
    ['blinkpay-thank-you-recurring', 'BlinkPay thank you — recurring', buildGivingEmail(source('blinkpay-thanks'), previewDate)],
  ] as const

  const cards = previews.map(([id, label, message]) => `
    <section class="card" id="${id}">
      <header><span>${escapeHtml(label)}</span><small>To preview@example.com</small><h2>${escapeHtml(message.subject)}</h2></header>
      <iframe sandbox="" title="${escapeHtml(label)} HTML preview" srcdoc="${escapeHtml(emailDocument(message.html))}"></iframe>
      <details><summary>Plain-text version</summary><pre>${escapeHtml(message.text)}</pre></details>
    </section>`).join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Giving email previews</title><style>
    :root{color:#0F0004;background:#FEFAF4;font-family:Arial,sans-serif}*{box-sizing:border-box}body{margin:0;padding:48px 24px}main{max-width:1120px;margin:auto}.eyebrow{color:#E22A30;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}h1{font-size:40px;margin:12px 0}main>p{color:#555;line-height:1.6;max-width:720px}.grid{display:grid;gap:40px;margin-top:40px}.card{overflow:hidden;border:1px solid #ddd5cc;border-radius:24px;background:#fff;box-shadow:0 4px 20px #0f00040d}.card header{padding:24px;border-bottom:1px solid #e5ded6}.card header span{display:block;color:#E22A30;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.card header small{display:block;color:#666;margin-top:8px}.card h2{font-size:24px;margin:8px 0 0}.card iframe{display:block;width:100%;height:540px;border:0;background:#fff}.card details{border-top:1px solid #e5ded6;padding:20px 24px}.card summary{cursor:pointer;font-weight:700}.card pre{color:#555;line-height:1.55;white-space:pre-wrap;overflow:auto}@media(max-width:640px){body{padding:32px 16px}h1{font-size:32px}.card iframe{height:620px}}
  </style></head><body><main><div class="eyebrow">Local development</div><h1>Giving email previews</h1><p>These previews use the production email builder with synthetic recipient and gift details. Edit <code>src/lib/giving/email.ts</code>, then reload after the preview server restarts.</p><div class="grid">${cards}</div></main></body></html>`
}

const server = createServer((request, response) => {
  if (request.method !== 'GET' || !['/', '/dev/giving-emails'].includes(request.url ?? '')) {
    response.writeHead(404).end('Not found')
    return
  }
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow',
  }).end(page())
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Giving email previews: http://localhost:${port}/dev/giving-emails`)
})
